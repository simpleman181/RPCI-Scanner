import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Technical Indicator Helpers ─────────────────────────────────────────────

/**
 * FIX #1 — Wilder Smoothed RSI (industry standard).
 * Old code used a simple 14-bar average which diverged up to 15 pts on trending stocks.
 * Wilder smoothing processes the FULL history, matching TradingView / Chartink values.
 */
function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const ema: number[] = [data[0]];
  const multiplier = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * multiplier + ema[i - 1] * (1 - multiplier));
  }
  return ema;
}

/**
 * Returns Bollinger bandwidth (%) for a given close array.
 * Extracted as a helper so we can call it multiple times for streak detection.
 */
function calcBBWidth(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  return mean === 0 ? 0 : ((mean + 2 * std - (mean - 2 * std)) / mean) * 100;
}

function calcBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number; bandwidth: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + stdDev * std;
  const lower = mean - stdDev * std;
  const bandwidth = mean === 0 ? 0 : ((upper - lower) / mean) * 100;
  return { upper, middle: mean, lower, bandwidth };
}

function calcATR(candles: Candle[], period: number = 14): number[] {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const atrs = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrs.push(atr);
  }
  return atrs;
}

// ─── Load stocks from public/stocks.json ─────────────────────────────────────

function loadStocksConfig(): { symbols: string[]; fno: string[] } {
  try {
    const filePath = path.join(process.cwd(), "public", "stocks.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { symbols: [], fno: [] };
  }
}

// ─── Fetch Data from Yahoo Finance ───────────────────────────────────────────

/**
 * FIX #2 — Rolling date window.
 * Old code had hardcoded "2025-06-01" which grows stale over time.
 * Now always fetches 12 months of daily data and 15 months of weekly data
 * relative to today, keeping indicator calculations stable.
 */
function getRollingDate(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().split("T")[0];
}

async function fetchDailyData(symbol: string): Promise<Candle[] | null> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    const dailyData = await yahooFinance.chart(symbol, {
      period1: getRollingDate(12),
      interval: "1d",
    });
    if (!dailyData || !dailyData.quotes || dailyData.quotes.length < 50) return null;
    return dailyData.quotes
      .filter((q: any) => q.open != null && q.close != null && q.high != null && q.low != null)
      .map((q: any) => ({
        date: q.date?.toISOString?.()?.split("T")[0] || "",
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
      }));
  } catch {
    return null;
  }
}

async function fetchWeeklyData(symbol: string): Promise<Candle[] | null> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    const weeklyData = await yahooFinance.chart(symbol, {
      period1: getRollingDate(15),
      interval: "1wk",
    });
    if (!weeklyData || !weeklyData.quotes || weeklyData.quotes.length < 14) return null;
    return weeklyData.quotes
      .filter((q: any) => q.open != null && q.close != null && q.high != null && q.low != null)
      .map((q: any) => ({
        date: q.date?.toISOString?.()?.split("T")[0] || "",
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
      }));
  } catch {
    return null;
  }
}

// ─── Criteria Evaluation ─────────────────────────────────────────────────────

interface CriteriaResult {
  id: string;
  name: string;
  passed: boolean;
  value: string;
  detail: string;
}

interface StockResult {
  symbol: string;
  name: string;
  isFNO: boolean;
  price: number;
  change: number;
  changePercent: number;
  weeklyRSI: number;
  dailyRSI: number;
  distanceFrom50EMA: number;
  bbBandwidth: number;
  bbBandwidthRatio: number;
  rangeCompression: number;
  avgRange: number;
  volumeRatio: number;
  criteria: CriteriaResult[];
  score: number;
  totalCriteria: number;
}

function evaluateStock(
  dailyCandles: Candle[],
  weeklyCandles: Candle[],
  symbol: string,
  fnoSet: Set<string>
): StockResult | null {
  if (!dailyCandles || dailyCandles.length < 50) return null;
  if (!weeklyCandles || weeklyCandles.length < 14) return null;

  const closes = dailyCandles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  const change = currentPrice - prevPrice;
  const changePercent = (change / prevPrice) * 100;
  const baseSymbol = symbol.replace(".NS", "");
  const isFNO = fnoSet.has(baseSymbol);

  // ── 1. Weekly RSI > 60 ──────────────────────────────────────────────────
  const weeklyCloses = weeklyCandles.map((c) => c.close);
  const weeklyRSI = calcRSI(weeklyCloses, 14);
  const weeklyRSIPassed = weeklyRSI > 60;

  // ── 2. Daily RSI 50–65 (IMPROVED from 40–75) ──────────────────────────
  // Tightened: RSI 40-50 = weak, 65-75 = already moving. 50-65 = the coil zone.
  const dailyRSI = calcRSI(closes, 14);
  const dailyRSIPassed = dailyRSI >= 50 && dailyRSI <= 65;

  // ── 3. Price near 50-day EMA (−5% to +10%) ────────────────────────────
  const ema50 = calcEMA(closes, 50);
  const currentEMA50 = ema50[ema50.length - 1];
  const distanceFrom50EMA = ((currentPrice - currentEMA50) / currentEMA50) * 100;
  const near50EMA = distanceFrom50EMA >= -5 && distanceFrom50EMA <= 10;

  // ── 4. BB Squeeze — 3 consecutive bandwidth contractions ──────────────
  // FIX: Old code compared current vs 10-bars-ago (overlapping windows).
  // New: check that BB width has contracted in 3 of the last 4 consecutive bar-pairs.
  // This eliminates false positives where a stock already broke out.
  const bwHistory: number[] = [];
  for (let offset = 4; offset >= 0; offset--) {
    bwHistory.push(calcBBWidth(closes.slice(0, closes.length - offset), 20));
  }
  let contractionCount = 0;
  for (let i = 1; i < bwHistory.length; i++) {
    if (bwHistory[i] < bwHistory[i - 1]) contractionCount++;
  }
  const bbSqueeze = contractionCount >= 3;
  const bbCurrent = calcBollingerBands(closes, 20, 2);
  const bbBandwidthRatio = bwHistory[0] > 0 ? bwHistory[bwHistory.length - 1] / bwHistory[0] : 1;

  // ── 5. Daily Range Compression (last 10 vs prior 10) ──────────────────
  const recent10Ranges = dailyCandles.slice(-10).map((c) => ((c.high - c.low) / c.close) * 100);
  const prev10Ranges = dailyCandles.slice(-20, -10).map((c) => ((c.high - c.low) / c.close) * 100);
  const avgRecentRange = recent10Ranges.reduce((a, b) => a + b, 0) / recent10Ranges.length;
  const avgPrevRange = prev10Ranges.length > 0
    ? prev10Ranges.reduce((a, b) => a + b, 0) / prev10Ranges.length
    : avgRecentRange;
  const rangeCompression = avgPrevRange > 0 ? avgRecentRange / avgPrevRange : 1;
  const isCompressing = rangeCompression < 0.92;

  // ── 6. Circuit filter — FIX: vs previous CLOSE, not today's open ──────
  // NSE circuit bands are calculated from the PREVIOUS DAY'S close.
  const dailyChangeFromPrevClose = ((currentPrice - prevPrice) / prevPrice) * 100;
  const notCircuit = Math.abs(dailyChangeFromPrevClose) < 4.5;

  // ── 7. ATR Declining (Volatility Shrink) ──────────────────────────────
  const atrs = calcATR(dailyCandles, 14);
  let atrShrinking = false;
  let avgATR = 0;
  if (atrs.length >= 10) {
    const recentATR = atrs.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prevATR = atrs.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    avgATR = recentATR;
    atrShrinking = prevATR > 0 && recentATR < prevATR;
  } else if (atrs.length > 0) {
    avgATR = atrs[atrs.length - 1];
  }

  // ── 8. Volume in healthy range 0.3x–2.0x (IMPROVED from upper-only) ──
  const recentVol = dailyCandles.slice(-5).map((c) => c.volume);
  const avgVol50 = dailyCandles.slice(-50).map((c) => c.volume);
  const recentAvgVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
  const avg50Vol = avgVol50.reduce((a, b) => a + b, 0) / avgVol50.length;
  const volumeRatio = avg50Vol > 0 ? recentAvgVol / avg50Vol : 1;
  const volumeOK = volumeRatio >= 0.3 && volumeRatio <= 2.0;

  // ── 9. Not Stretched — tightened from >30% to >10% of 50 EMA ─────────
  const notStretched = distanceFrom50EMA <= 10;

  // ── 10. Volume Dry-Up ─────────────────────────────────────────────────
  const last3Vol = dailyCandles.slice(-3).map((c) => c.volume);
  const last3AvgVol = last3Vol.reduce((a, b) => a + b, 0) / 3;
  const vduRatio = avg50Vol > 0 ? last3AvgVol / avg50Vol : 1;
  const volumeDryUp = vduRatio < 0.75;

  // ── 11. NR7 — Narrowest Range in 7 Days ──────────────────────────────
  const last7Candles = dailyCandles.slice(-7);
  const last7Ranges = last7Candles.map((c) => c.high - c.low);
  const todayRange = last7Ranges[last7Ranges.length - 1];
  const isNR7 = todayRange === Math.min(...last7Ranges);

  // ── 12. Tight 20-Day Price Band < 8% ─────────────────────────────────
  const last20Highs = dailyCandles.slice(-20).map((c) => c.high);
  const last20Lows = dailyCandles.slice(-20).map((c) => c.low);
  const bandWidth20d = (Math.max(...last20Highs) - Math.min(...last20Lows)) / currentPrice * 100;
  const tightBand = bandWidth20d < 8.0;

  // ── 13. Flat 20-EMA Slope < 0.20% over 5 bars ────────────────────────
  const ema20 = calcEMA(closes, 20);
  const ema20Slope = ema20.length >= 6
    ? Math.abs((ema20[ema20.length - 1] - ema20[ema20.length - 6]) / ema20[ema20.length - 6]) * 100
    : 99;
  const ema20Flat = ema20Slope < 0.20;

  // ── Build criteria array ──────────────────────────────────────────────
  const criteria: CriteriaResult[] = [
    {
      id: "weekly_rsi",
      name: "Weekly RSI > 60",
      passed: weeklyRSIPassed,
      value: weeklyRSI.toFixed(1),
      detail: weeklyRSIPassed
        ? "Bullish momentum on weekly timeframe confirmed"
        : `Weekly RSI at ${weeklyRSI.toFixed(1)} — below 60 threshold`,
    },
    {
      id: "daily_rsi",
      name: "Daily RSI (50–65, Coil Zone)",
      passed: dailyRSIPassed,
      value: dailyRSI.toFixed(1),
      detail: dailyRSIPassed
        ? `Daily RSI ${dailyRSI.toFixed(1)} — in pre-breakout coil zone`
        : dailyRSI > 65
          ? `RSI ${dailyRSI.toFixed(1)} — already moving, not a coil setup`
          : `RSI ${dailyRSI.toFixed(1)} — too weak, below 50`,
    },
    {
      id: "near_50ema",
      name: "Price within ±5–10% of 50 EMA",
      passed: near50EMA,
      value: `${distanceFrom50EMA > 0 ? "+" : ""}${distanceFrom50EMA.toFixed(1)}%`,
      detail: near50EMA
        ? `Price ${distanceFrom50EMA.toFixed(1)}% from 50 EMA — ideal consolidation zone`
        : `${distanceFrom50EMA.toFixed(1)}% from 50 EMA — outside the consolidation band`,
    },
    {
      id: "bb_squeeze",
      name: "BB Squeeze (3 consecutive contractions)",
      passed: bbSqueeze,
      value: `${contractionCount}/4 bars contracting`,
      detail: bbSqueeze
        ? `BB width contracting ${contractionCount} of last 4 bars — genuine squeeze building`
        : `Only ${contractionCount}/4 bars contracting — not a confirmed squeeze`,
    },
    {
      id: "range_compression",
      name: "Daily Range Compression",
      passed: isCompressing,
      value: `Ratio: ${rangeCompression.toFixed(3)}`,
      detail: isCompressing
        ? `Range compressing: recent ${avgRecentRange.toFixed(2)}% vs prior ${avgPrevRange.toFixed(2)}%`
        : `Range not compressing (ratio: ${rangeCompression.toFixed(3)})`,
    },
    {
      id: "not_circuit",
      name: "Not at Circuit Limit",
      passed: notCircuit,
      value: `${dailyChangeFromPrevClose > 0 ? "+" : ""}${dailyChangeFromPrevClose.toFixed(1)}% vs prev close`,
      detail: notCircuit
        ? "Move from previous close within normal range"
        : "Near or at circuit limit vs previous close — avoid",
    },
    {
      id: "atr_shrinking",
      name: "ATR Declining (Volatility Shrink)",
      passed: atrShrinking,
      value: avgATR > 0 ? avgATR.toFixed(2) : "N/A",
      detail: atrShrinking
        ? "ATR declining — volatility compression underway"
        : "ATR not declining — volatility not reducing yet",
    },
    {
      id: "volume_ok",
      name: "Volume in Healthy Range (0.3x–2x avg)",
      passed: volumeOK,
      value: `${volumeRatio.toFixed(2)}x avg`,
      detail: volumeOK
        ? `Volume at ${volumeRatio.toFixed(2)}x average — healthy, no panic or distribution`
        : volumeRatio > 2.0
          ? `Volume spike at ${volumeRatio.toFixed(2)}x — possible distribution`
          : `Volume too thin at ${volumeRatio.toFixed(2)}x — stock may be illiquid`,
    },
    {
      id: "not_stretched",
      name: "Not Extended (within 10% of 50 EMA)",
      passed: notStretched,
      value: `${distanceFrom50EMA > 0 ? "+" : ""}${distanceFrom50EMA.toFixed(1)}%`,
      detail: notStretched
        ? "Price not extended above 50 EMA"
        : `Price ${distanceFrom50EMA.toFixed(1)}% above 50 EMA — too extended for safe entry`,
    },
    {
      id: "volume_dry_up",
      name: "Volume Dry-Up (Last 3 bars < 0.75x avg)",
      passed: volumeDryUp,
      value: `${vduRatio.toFixed(2)}x avg`,
      detail: volumeDryUp
        ? `Volume dried up to ${vduRatio.toFixed(2)}x average — classic pre-breakout quiet`
        : `Volume at ${vduRatio.toFixed(2)}x — no dry-up detected yet`,
    },
    {
      id: "nr7",
      name: "NR7 — Narrowest Range in 7 Days",
      passed: isNR7,
      value: `Today: ${todayRange.toFixed(1)} | Min7: ${Math.min(...last7Ranges).toFixed(1)}`,
      detail: isNR7
        ? "Today is the narrowest range candle in 7 days — spring fully coiled"
        : "Today's range is not the narrowest in 7 days — NR7 not triggered",
    },
    {
      id: "tight_band",
      name: "Tight 20-Day Price Band (< 8%)",
      passed: tightBand,
      value: `${bandWidth20d.toFixed(1)}% band`,
      detail: tightBand
        ? `20-day high-low band is only ${bandWidth20d.toFixed(1)}% — price tightly contained`
        : `20-day band is ${bandWidth20d.toFixed(1)}% — too wide, not a tight consolidation`,
    },
    {
      id: "ema20_flat",
      name: "Flat 20-EMA Slope (< 0.20% / 5 bars)",
      passed: ema20Flat,
      value: `Slope: ${ema20Slope.toFixed(3)}%`,
      detail: ema20Flat
        ? `20-EMA slope is flat at ${ema20Slope.toFixed(3)}% — consolidating at elevated level`
        : `20-EMA slope ${ema20Slope.toFixed(3)}% — still trending, not yet flat`,
    },
  ];

  const passedCount = criteria.filter((c) => c.passed).length;

  return {
    symbol,
    name: baseSymbol,
    isFNO,
    price: currentPrice,
    change,
    changePercent,
    weeklyRSI,
    dailyRSI,
    distanceFrom50EMA,
    bbBandwidth: bbCurrent.bandwidth,
    bbBandwidthRatio,
    rangeCompression,
    avgRange: avgRecentRange,
    volumeRatio,
    criteria,
    score: passedCount,
    totalCriteria: criteria.length,
  };
}

// ─── API Route Handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get("minScore") || "6");
    const fnoOnly = searchParams.get("fnoOnly") === "true";
    const nonFnoOnly = searchParams.get("nonFnoOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "30");

    const { symbols: allSymbols, fno: fnoList } = loadStocksConfig();
    const FNO_STOCKS = new Set(fnoList);

    const scanList = allSymbols.filter((s) => {
      const base = s.replace(".NS", "");
      if (fnoOnly && !FNO_STOCKS.has(base)) return false;
      if (nonFnoOnly && FNO_STOCKS.has(base)) return false;
      return true;
    });

    const results: StockResult[] = [];
    const errors: string[] = [];

    const batchSize = 3;
    for (let i = 0; i < scanList.length && results.length < limit; i += batchSize) {
      const batch = scanList.slice(i, i + batchSize);
      const promises = batch.map(async (symbol) => {
        try {
          const [dailyData, weeklyData] = await Promise.all([
            fetchDailyData(symbol),
            fetchWeeklyData(symbol),
          ]);
          if (!dailyData || !weeklyData) return null;
          return evaluateStock(dailyData, weeklyData, symbol, FNO_STOCKS);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${symbol}: ${msg}`);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      for (const r of batchResults) {
        if (r && r.score >= minScore) results.push(r);
      }
    }

    results.sort((a, b) => b.score !== a.score ? b.score - a.score : b.weeklyRSI - a.weeklyRSI);

    return NextResponse.json({
      success: true,
      scanned: scanList.length,
      found: results.length,
      timestamp: new Date().toISOString(),
      filters: { minScore, fnoOnly, nonFnoOnly },
      stocks: results.slice(0, limit),
      errors: errors.slice(0, 20),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
