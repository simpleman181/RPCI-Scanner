import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// ─── Technical Indicator Helpers ────────────────────────────────────────

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
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

function calcBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number; bandwidth: number } {
  if (closes.length < period)
    return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
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

// ─── Load stocks from public/stocks.json ────────────────────────────────

function loadStocksConfig(): { symbols: string[]; fno: string[] } {
  try {
    const filePath = path.join(process.cwd(), "public", "stocks.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    // fallback defaults if file missing
    return { symbols: [], fno: [] };
  }
}

// ─── Fetch Data from Yahoo Finance ──────────────────────────────────────

async function fetchDailyData(symbol: string): Promise<Candle[] | null> {
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    const dailyData = await yahooFinance.chart(symbol, {
      period1: "2025-06-01",
      interval: "1d",
    });
    if (!dailyData || !dailyData.quotes || dailyData.quotes.length < 50) return null;
    return dailyData.quotes
      .filter(
        (q: any) =>
          q.open != null && q.close != null && q.high != null && q.low != null
      )
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
      period1: "2025-03-01",
      interval: "1wk",
    });
    if (!weeklyData || !weeklyData.quotes || weeklyData.quotes.length < 14)
      return null;
    return weeklyData.quotes
      .filter(
        (q: any) =>
          q.open != null && q.close != null && q.high != null && q.low != null
      )
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

// ─── Criteria Evaluation ────────────────────────────────────────────────

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

  const weeklyCloses = weeklyCandles.map((c) => c.close);
  const weeklyRSI = calcRSI(weeklyCloses, 14);
  const weeklyRSIPassed = weeklyRSI > 60;

  const dailyRSI = calcRSI(closes, 14);
  const dailyRSIPassed = dailyRSI >= 40 && dailyRSI <= 75;

  const ema50 = calcEMA(closes, 50);
  const currentEMA50 = ema50[ema50.length - 1];
  const distanceFrom50EMA = ((currentPrice - currentEMA50) / currentEMA50) * 100;
  const near50EMA = distanceFrom50EMA >= -5 && distanceFrom50EMA <= 15;

  const bbCurrent = calcBollingerBands(closes, 20, 2);
  const bbPrev10 = calcBollingerBands(closes.slice(0, -10), 20, 2);
  const bbBandwidthRatio = bbPrev10.bandwidth > 0 ? bbCurrent.bandwidth / bbPrev10.bandwidth : 1;
  const bbSqueeze = bbBandwidthRatio < 0.95;

  const recent10Ranges = dailyCandles.slice(-10).map((c) => ((c.high - c.low) / c.close) * 100);
  const prev10Ranges = dailyCandles.slice(-20, -10).map((c) => ((c.high - c.low) / c.close) * 100);
  const avgRecentRange = recent10Ranges.reduce((a, b) => a + b, 0) / recent10Ranges.length;
  const avgPrevRange = prev10Ranges.length > 0 ? prev10Ranges.reduce((a, b) => a + b, 0) / prev10Ranges.length : avgRecentRange;
  const rangeCompression = avgPrevRange > 0 ? avgRecentRange / avgPrevRange : 1;
  const isCompressing = rangeCompression < 0.95;

  const dailyChange = ((currentPrice - dailyCandles[dailyCandles.length - 1].open) / dailyCandles[dailyCandles.length - 1].open) * 100;
  const notCircuit = Math.abs(dailyChange) < 4.5;

  const atrs = calcATR(dailyCandles, 14);
  let atrShrinking = false;
  let avgATR = 0;
  if (atrs.length >= 10) {
    const recentATR = atrs.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prevATR = atrs.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    avgATR = recentATR;
    atrShrinking = prevATR > 0 ? recentATR < prevATR : false;
  } else if (atrs.length > 0) {
    avgATR = atrs[atrs.length - 1];
  }

  const recentVol = dailyCandles.slice(-5).map((c) => c.volume);
  const avgVol50 = dailyCandles.slice(-50).map((c) => c.volume);
  const recentAvgVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
  const avg50Vol = avgVol50.reduce((a, b) => a + b, 0) / avgVol50.length;
  const volumeRatio = avg50Vol > 0 ? recentAvgVol / avg50Vol : 1;
  const volumeOK = volumeRatio < 2.5;

  const notStretched = distanceFrom50EMA <= 30;

  const criteria: CriteriaResult[] = [
    {
      id: "weekly_rsi",
      name: "Weekly RSI > 60",
      passed: weeklyRSIPassed,
      value: weeklyRSI.toFixed(1),
      detail: weeklyRSIPassed ? "Bullish momentum on weekly timeframe confirmed" : `Weekly RSI at ${weeklyRSI.toFixed(1)} - below the 60 threshold for range shift`,
    },
    {
      id: "daily_rsi",
      name: "Daily RSI (40-75)",
      passed: dailyRSIPassed,
      value: dailyRSI.toFixed(1),
      detail: dailyRSIPassed ? "Daily RSI in healthy range" : dailyRSI > 75 ? "Overbought territory - potential pullback risk" : "Weak momentum - RSI below 40",
    },
    {
      id: "near_50ema",
      name: "Price near 50-day EMA",
      passed: near50EMA,
      value: `${distanceFrom50EMA > 0 ? "+" : ""}${distanceFrom50EMA.toFixed(1)}%`,
      detail: near50EMA ? `Stock is within normal range of 50 EMA (${distanceFrom50EMA.toFixed(1)}%)` : `Too far from 50 EMA (${distanceFrom50EMA.toFixed(1)}%) - may be stretched or broken down`,
    },
    {
      id: "bb_squeeze",
      name: "Bollinger Band Squeeze",
      passed: bbSqueeze,
      value: `Ratio: ${bbBandwidthRatio.toFixed(3)}`,
      detail: bbSqueeze ? `BB Width contracting (${bbCurrent.bandwidth.toFixed(2)}% vs ${bbPrev10.bandwidth.toFixed(2)}%) - consolidation detected` : `BB Width not contracting (${bbBandwidthRatio.toFixed(3)}) - no clear consolidation`,
    },
    {
      id: "range_compression",
      name: "Daily Range Compression",
      passed: isCompressing,
      value: `Ratio: ${rangeCompression.toFixed(3)}`,
      detail: isCompressing ? `Range compressing: recent avg ${(avgRecentRange * 100).toFixed(1)}% vs prior ${(avgPrevRange * 100).toFixed(1)}%` : `Range not compressing (ratio: ${rangeCompression.toFixed(3)})`,
    },
    {
      id: "not_circuit",
      name: "Not at Circuit Limit (5%)",
      passed: notCircuit,
      value: `${dailyChange > 0 ? "+" : ""}${dailyChange.toFixed(1)}%`,
      detail: notCircuit ? "Not hitting circuit - safe to trade as per RPCI rules" : "At or near circuit limit - avoid per RPCI guidelines",
    },
    {
      id: "atr_shrinking",
      name: "ATR Declining (Volatility Shrink)",
      passed: atrShrinking,
      value: avgATR > 0 ? avgATR.toFixed(2) : "N/A",
      detail: atrShrinking ? "ATR declining over 5 bars - volatility compression underway" : "ATR not declining - volatility not reducing",
    },
    {
      id: "volume_ok",
      name: "Normal Volume (No Panic)",
      passed: volumeOK,
      value: `${volumeRatio.toFixed(2)}x avg`,
      detail: volumeOK ? "Volume within normal bounds - no panic selling or distribution" : "Abnormal volume spike detected - possible distribution",
    },
    {
      id: "not_stretched",
      name: "Not Stretched (>30% from 50 EMA)",
      passed: notStretched,
      value: `${distanceFrom50EMA > 0 ? "+" : ""}${distanceFrom50EMA.toFixed(1)}%`,
      detail: notStretched ? `Within acceptable distance from 50 EMA` : `Price is ${distanceFrom50EMA.toFixed(1)}% from 50 EMA - stretched, high risk`,
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

// ─── API Route Handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get("minScore") || "5");
    const fnoOnly = searchParams.get("fnoOnly") === "true";
    const nonFnoOnly = searchParams.get("nonFnoOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "30");

    // Load stock list from stocks.json
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
        if (r && r.score >= minScore) {
          results.push(r);
        }
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.weeklyRSI - a.weeklyRSI;
    });

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
