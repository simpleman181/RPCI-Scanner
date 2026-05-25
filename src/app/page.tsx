'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
  BarChart3,
  Filter,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────

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

interface ScanResponse {
  success: boolean;
  scanned: number;
  found: number;
  timestamp: string;
  filters: { minScore: number; fnoOnly: boolean; nonFnoOnly: boolean };
  stocks: StockResult[];
  errors: string[];
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [minScore, setMinScore] = useState('5');
  const [stockType, setStockType] = useState('all');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);

  const runScan = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams();
      params.set('minScore', minScore);
      params.set('limit', '30');
      if (stockType === 'fno') params.set('fnoOnly', 'true');
      if (stockType === 'nonfno') params.set('nonFnoOnly', 'true');

      const res = await fetch(`/api/scan?${params.toString()}`);
      const json: ScanResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setLoading(false);
    }
  }, [minScore, stockType]);

  // Auto-scan on mount
  useEffect(() => {
    if (autoScan) return;
    setAutoScan(true);
    runScan();
  }, [runScan, autoScan]);

  const toggleExpand = (symbol: string) => {
    setExpandedCard(expandedCard === symbol ? null : symbol);
  };

  const getScoreColor = (score: number, total: number) => {
    const pct = score / total;
    if (pct >= 0.78) return 'text-emerald-600';
    if (pct >= 0.56) return 'text-amber-600';
    return 'text-red-500';
  };

  const getScoreBg = (score: number, total: number) => {
    const pct = score / total;
    if (pct >= 0.78) return 'bg-emerald-50 border-emerald-200';
    if (pct >= 0.56) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreBadgeVariant = (score: number, total: number) => {
    const pct = score / total;
    if (pct >= 0.78) return 'default';
    if (pct >= 0.56) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RPCI Stock Scanner</h1>
                <p className="text-xs text-gray-500">NSE India &bull; Automated Range Compression Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={minScore} onValueChange={setMinScore}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Min Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3+ Criteria</SelectItem>
                  <SelectItem value="5">5+ Criteria</SelectItem>
                  <SelectItem value="7">7+ Criteria</SelectItem>
                  <SelectItem value="8">8+ Criteria</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockType} onValueChange={setStockType}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Stock Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stocks</SelectItem>
                  <SelectItem value="fno">F&O Only</SelectItem>
                  <SelectItem value="nonfno">Non-F&O Only</SelectItem>
                </SelectContent>
              </Select>
              <Link href="/stocks">
                <Button variant="outline" size="sm" className="h-9 gap-1.5 border-gray-200 text-gray-600 hover:text-gray-900">
                  <Settings2 className="w-3.5 h-3.5" />
                  Manage Stocks
                </Button>
              </Link>
              <Button
                onClick={runScan}
                disabled={loading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                {loading ? 'Scanning...' : 'Scan Now'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Criteria Reference */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">RPCI (Range Percent Compression Indicator)</span> identifies stocks in consolidation
                before a potential breakout. Criteria based on your PDF guide &amp; Chartink scanners:
                <span className="font-medium"> Weekly RSI &gt; 60</span> (momentum range shift),
                <span className="font-medium"> BB Squeeze</span>,
                <span className="font-medium"> Range Compression</span>,
                <span className="font-medium"> ATR Decline</span>, and
                <span className="font-medium"> Not at Circuit</span>. Avoidance rules: no 5% circuit stocks, no LT ASM, not stretched &gt;30% from 50 EMA.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Scanning NSE Stocks...</p>
              <p className="text-xs text-gray-400 mt-1">Fetching daily &amp; weekly data, calculating 9 criteria per stock</p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card className="py-3 px-4">
                <div className="text-xs text-gray-500">Stocks Scanned</div>
                <div className="text-lg font-bold text-gray-900">{data.scanned}</div>
              </Card>
              <Card className="py-3 px-4">
                <div className="text-xs text-gray-500">Stocks Found</div>
                <div className="text-lg font-bold text-emerald-600">{data.found}</div>
              </Card>
              <Card className="py-3 px-4">
                <div className="text-xs text-gray-500">Min Score Filter</div>
                <div className="text-lg font-bold text-gray-900">{data.filters.minScore}+</div>
              </Card>
              <Card className="py-3 px-4">
                <div className="text-xs text-gray-500">Last Updated</div>
                <div className="text-sm font-medium text-gray-700">
                  {new Date(data.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
              </Card>
            </div>

            {/* Stock Cards */}
            {data.stocks.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">No stocks matched your criteria</p>
                  <p className="text-xs text-gray-400 mt-1">Try lowering the minimum score filter and scan again</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.stocks.map((stock, idx) => (
                  <Card
                    key={stock.symbol}
                    className={`border overflow-hidden transition-all hover:shadow-md ${
                      stock.score >= stock.totalCriteria * 0.78
                        ? 'border-emerald-200'
                        : stock.score >= stock.totalCriteria * 0.56
                          ? 'border-amber-200'
                          : 'border-gray-200'
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      className="px-4 sm:px-6 py-4 cursor-pointer"
                      onClick={() => toggleExpand(stock.symbol)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank */}
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-600">#{idx + 1}</span>
                          </div>

                          {/* Stock Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                {stock.name}
                              </h3>
                              <Badge variant={stock.isFNO ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                {stock.isFNO ? (
                                  <span className="flex items-center gap-0.5">
                                    <Shield className="w-2.5 h-2.5" /> F&O
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5">
                                    <Activity className="w-2.5 h-2.5" /> Non-F&O
                                  </span>
                                )}
                              </Badge>
                              <Badge
                                variant={getScoreBadgeVariant(stock.score, stock.totalCriteria)}
                                className={`text-[10px] px-1.5 py-0 font-bold ${stock.score >= stock.totalCriteria * 0.78 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : stock.score >= stock.totalCriteria * 0.56 ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}`}
                              >
                                {stock.score}/{stock.totalCriteria}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              NSE:{stock.symbol.replace('.NS', '')}
                            </p>
                          </div>
                        </div>

                        {/* Price & Change */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm sm:text-base font-bold text-gray-900">
                            {stock.price.toLocaleString('en-IN', {
                              maximumFractionDigits: 2,
                              style: 'currency',
                              currency: 'INR',
                            })}
                          </div>
                          <div
                            className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
                              stock.changePercent >= 0 ? 'text-emerald-600' : 'text-red-500'
                            }`}
                          >
                            {stock.changePercent >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {stock.changePercent >= 0 ? '+' : ''}
                            {stock.changePercent.toFixed(2)}%
                          </div>
                        </div>

                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          {expandedCard === stock.symbol ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Quick Stats Row */}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Wk RSI</span>
                          <span className={`text-xs font-bold ${stock.weeklyRSI > 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {stock.weeklyRSI.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-px h-3 bg-gray-200" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Dly RSI</span>
                          <span className="text-xs font-bold text-gray-700">
                            {stock.dailyRSI.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-px h-3 bg-gray-200" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">50 EMA</span>
                          <span className="text-xs font-bold text-gray-700">
                            {stock.distanceFrom50EMA > 0 ? '+' : ''}
                            {stock.distanceFrom50EMA.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-px h-3 bg-gray-200" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Vol</span>
                          <span className="text-xs font-bold text-gray-700">
                            {stock.volumeRatio.toFixed(2)}x
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              stock.score >= stock.totalCriteria * 0.78
                                ? 'bg-emerald-500'
                                : stock.score >= stock.totalCriteria * 0.56
                                  ? 'bg-amber-500'
                                  : 'bg-red-400'
                            }`}
                            style={{
                              width: `${(stock.score / stock.totalCriteria) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Criteria Details */}
                    {expandedCard === stock.symbol && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-4 sm:px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {stock.criteria.map((c) => (
                            <div
                              key={c.id}
                              className={`rounded-lg border p-3 ${
                                c.passed
                                  ? 'bg-emerald-50/70 border-emerald-200/70'
                                  : 'bg-red-50/50 border-red-200/70'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {c.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-xs font-semibold ${
                                        c.passed ? 'text-emerald-700' : 'text-red-600'
                                      }`}
                                    >
                                      {c.name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        c.passed
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-red-100 text-red-600'
                                      }`}
                                    >
                                      {c.value}
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[11px] mt-1 leading-relaxed ${
                                      c.passed ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                                  >
                                    {c.detail}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Chartink-style Summary */}
                        <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-semibold text-gray-700">RPCI Analysis Summary</span>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-relaxed">
                            <strong>{stock.name}</strong> ({stock.isFNO ? 'F&O' : 'Non-F&O'} Stock)
                            is currently at{' '}
                            <strong>
                              {stock.price.toLocaleString('en-IN', {
                                maximumFractionDigits: 2,
                                style: 'currency',
                                currency: 'INR',
                              })}
                            </strong>{' '}
                            with {stock.score} of {stock.totalCriteria} criteria met.{' '}
                            {stock.weeklyRSI > 60
                              ? 'Weekly RSI confirms bullish momentum (range shift active). '
                              : 'Weekly RSI is below 60 — momentum range shift not yet confirmed. '}
                            {stock.bbBandwidthRatio < 0.95
                              ? 'Bollinger Bands are squeezing, indicating consolidation. '
                              : ''}
                            {stock.rangeCompression < 0.95
                              ? 'Daily range is compressing — bars shrinking on RPCI. '
                              : ''}
                            {stock.distanceFrom50EMA > 30
                              ? 'Warning: Stock is stretched more than 30% above 50 EMA — avoid as per RPCI rules. '
                              : stock.distanceFrom50EMA < -5
                                ? 'Stock is below 50 EMA — caution advised. '
                                : ''}
                            {stock.volumeRatio > 2.5
                              ? 'Unusual volume detected — possible distribution phase. '
                              : ''}
                            {stock.score >= 7
                              ? 'Strong RPCI candidate — monitor for breakout with volume confirmation.'
                              : stock.score >= 5
                                ? 'Moderate match — keep on watchlist for further consolidation.'
                                : 'Weak match — does not meet most RPCI criteria.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Errors (if any) */}
            {data.errors && data.errors.length > 0 && (
              <div className="mt-6">
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium text-amber-700 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Some stocks could not be fetched ({data.errors.length} errors)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4">
                    <div className="max-h-32 overflow-y-auto">
                      {data.errors.map((err, i) => (
                        <p key={i} className="text-[10px] text-amber-600">
                          {err}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Footer Legend */}
        {data && data.stocks.length > 0 && (
          <div className="mt-8 pb-8">
            <Card>
              <CardContent className="py-4 px-6">
                <h4 className="text-xs font-semibold text-gray-700 mb-3">RPCI Scanner Criteria Reference</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                  {[
                    { name: 'Weekly RSI > 60', desc: 'RSI range shift on weekly timeframe confirms momentum' },
                    { name: 'Daily RSI (40-75)', desc: 'Healthy daily momentum, not overbought (>75) or oversold (<40)' },
                    { name: 'Price near 50 EMA', desc: 'Within -5% to +15% of 50-day EMA (not stretched)' },
                    { name: 'BB Squeeze', desc: 'Bollinger Band width contracting — consolidation phase' },
                    { name: 'Range Compression', desc: 'Recent 10-bar average range < previous 10-bar average' },
                    { name: 'Not at Circuit', desc: 'Not hitting 5% upper/lower circuit limit' },
                    { name: 'ATR Declining', desc: 'Average True Range shrinking — volatility reducing' },
                    { name: 'Normal Volume', desc: 'No panic volume spike (<2.5x 50-day average)' },
                    { name: 'Not Stretched', desc: 'Price within 30% of 50 EMA (avoid stretched setups)' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[10px] text-gray-400 mt-0.5">{i + 1}.</span>
                      <div>
                        <span className="text-[11px] font-medium text-gray-700">{item.name}</span>
                        <p className="text-[10px] text-gray-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
                  Data sourced from Yahoo Finance. This is an automated analysis tool and does not constitute financial advice. Always do your own research before trading.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
