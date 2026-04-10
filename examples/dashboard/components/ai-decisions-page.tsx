"use client"

import React, { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Brain, ArrowUpDown, ChevronDown, ChevronUp, Target, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Clock, BarChart3, X, Zap } from "lucide-react"
import type { DashboardData, HoldingDecision, Holding, Market } from "@/types/dashboard"
import { useLanguage } from "@/components/language-provider"
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency"
import { getNaverChartUrl } from "@/lib/naver-chart"

interface AIDecisionsPageProps {
  data: DashboardData
  market?: Market
}

type FilterTab = "all" | "hold" | "buy" | "sell"
type SortKey = "score" | "profit_rate" | "company_name" | "sector"
type SortDir = "asc" | "desc"

// --- helpers ---

function classifyDecision(decision: HoldingDecision): "buy" | "sell" | "hold" {
  if (decision.should_sell === 1) return "sell"
  if (decision.is_new_buy) return "buy"
  // check dynamic `decision` field
  const d = ((decision as any).decision as string)?.toLowerCase?.() ?? ""
  if (d.includes("매수") || d.includes("적극")) return "buy"
  if (d.includes("매도")) return "sell"
  return "hold"
}

function getDecisionLabel(decision: HoldingDecision, lang: string): string {
  const cls = classifyDecision(decision)
  if (cls === "sell") return lang === "ko" ? "매도" : "Sell"
  if (cls === "buy") return lang === "ko" ? "매수" : "Buy"
  // check dynamic field
  const d = (decision as any).decision as string | undefined
  if (d) return d
  return lang === "ko" ? "홀드" : "Hold"
}

function getDecisionBadgeClass(cls: "buy" | "sell" | "hold"): string {
  if (cls === "buy") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  if (cls === "sell") return "bg-red-500/20 text-red-400 border-red-500/30"
  return "bg-amber-500/20 text-amber-400 border-amber-500/30"
}

function getScore(d: HoldingDecision): number {
  return (d as any).buy_score ?? d.confidence ?? 0
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400"
  if (score >= 60) return "bg-emerald-500/10 text-emerald-300"
  if (score >= 40) return "bg-amber-500/10 text-amber-400"
  return "bg-red-500/15 text-red-400"
}

function getBuyScoreColor(score: number): string {
  if (score >= 80) return "text-red-400"
  if (score >= 60) return "text-orange-400"
  if (score >= 40) return "text-yellow-400"
  if (score >= 20) return "text-green-400"
  return "text-blue-400"
}

export function AIDecisionsPage({ data, market = "KR" }: AIDecisionsPageProps) {
  const { t, language } = useLanguage()
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [selectedDecision, setSelectedDecision] = useState<HoldingDecision | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const formatCurrency = (value: number) =>
    formatCurrencyUtil(value, market, language as "ko" | "en")

  const formatPercent = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "0.00%"
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  // --- deduplicate: latest decision per ticker ---
  const latestDecisions = useMemo(() => {
    const map = new Map<string, HoldingDecision>()
    for (const d of data.holding_decisions ?? []) {
      const existing = map.get(d.ticker)
      if (!existing || d.decision_date > existing.decision_date ||
          (d.decision_date === existing.decision_date && d.decision_time > existing.decision_time)) {
        map.set(d.ticker, d)
      }
    }
    return Array.from(map.values())
  }, [data.holding_decisions])

  // --- holdings lookup ---
  const getStockInfo = (ticker: string): Holding | undefined => {
    return data.holdings?.find(h => h.ticker === ticker)
  }

  // --- counts ---
  const holdCount = latestDecisions.filter(d => classifyDecision(d) === "hold").length
  const buyCount = latestDecisions.filter(d => classifyDecision(d) === "buy").length
  const sellCount = latestDecisions.filter(d => classifyDecision(d) === "sell").length
  const avgScore =
    latestDecisions.length > 0
      ? latestDecisions.reduce((sum, d) => sum + getScore(d), 0) / latestDecisions.length
      : 0

  // --- filter ---
  const filtered = useMemo(() => {
    if (activeFilter === "all") return latestDecisions
    return latestDecisions.filter(d => classifyDecision(d) === activeFilter)
  }, [latestDecisions, activeFilter])

  // --- sort ---
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      const stockA = getStockInfo(a.ticker)
      const stockB = getStockInfo(b.ticker)
      switch (sortKey) {
        case "score":
          return (getScore(a) - getScore(b)) * dir
        case "profit_rate":
          return ((stockA?.profit_rate ?? 0) - (stockB?.profit_rate ?? 0)) * dir
        case "company_name": {
          const nameA = a.company_name || stockA?.company_name || a.ticker
          const nameB = b.company_name || stockB?.company_name || b.ticker
          return nameA.localeCompare(nameB) * dir
        }
        case "sector":
          return (stockA?.sector ?? "").localeCompare(stockB?.sector ?? "") * dir
        default:
          return 0
      }
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: language === "ko" ? "전체" : "All", count: latestDecisions.length },
    { key: "hold", label: language === "ko" ? "홀드" : "Hold", count: holdCount },
    { key: "buy", label: language === "ko" ? "매수" : "Buy", count: buyCount },
    { key: "sell", label: language === "ko" ? "매도" : "Sell", count: sellCount },
  ]

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />
    return sortDir === "desc" ? (
      <ChevronDown className="w-3 h-3 ml-1" />
    ) : (
      <ChevronUp className="w-3 h-3 ml-1" />
    )
  }

  // --- empty state ---
  if (!data.holding_decisions || data.holding_decisions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-12 text-center">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">{t("aiDecisions.noAnalysisDataYet")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ===== Section 1: Summary Badges ===== */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {language === "ko" ? "전체" : "Total"} {latestDecisions.length}
        </Badge>
        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
          {language === "ko" ? "홀드" : "Hold"} {holdCount}
        </Badge>
        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          {language === "ko" ? "매수" : "Buy"} {buyCount}
        </Badge>
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
          {language === "ko" ? "매도" : "Sell"} {sellCount}
        </Badge>
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
          {language === "ko" ? "평균 점수" : "Avg Score"} {avgScore.toFixed(1)}
        </Badge>
        {data.generated_at && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Clock className="w-3 h-3" />
            {language === "ko" ? "분석" : "Analyzed"}: {data.generated_at.replace("T", " ").substring(0, 16)}
          </span>
        )}
      </div>

      {/* ===== Section 2: Filter Tabs ===== */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* ===== Section 3: Stock Table ===== */}
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-16 text-center">
                {language === "ko" ? "판단" : "Decision"}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("company_name")}
              >
                <span className="flex items-center">
                  {language === "ko" ? "종목명" : "Name"}
                  <SortIcon col="company_name" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("sector")}
              >
                <span className="flex items-center">
                  {language === "ko" ? "섹터" : "Sector"}
                  <SortIcon col="sector" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("profit_rate")}
              >
                <span className="flex items-center justify-end">
                  {language === "ko" ? "수익률" : "P/L"}
                  <SortIcon col="profit_rate" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((decision, index) => {
              const stock = getStockInfo(decision.ticker)
              const companyName = decision.company_name || stock?.company_name || (decision as any).name || decision.ticker
              const cls = classifyDecision(decision)
              const decLabel = getDecisionLabel(decision, language)
              const naverUrl = getNaverChartUrl(decision.ticker)
              const profitRate = stock?.profit_rate ?? null

              return (
                <TableRow
                  key={`row-${decision.id ?? index}`}
                  className="cursor-pointer border-border/30 hover:bg-muted/40"
                  onClick={() => setSelectedDecision(decision)}
                >
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${getDecisionBadgeClass(cls)}`}>
                      {decLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{companyName}</span>
                        {decision.is_new_buy && (
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[10px] px-1.5 py-0">
                            NEW
                          </Badge>
                        )}
                      </div>
                      {naverUrl ? (
                        <a
                          href={naverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:underline"
                        >
                          {decision.ticker}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{decision.ticker}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {stock?.sector || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {profitRate !== null ? (
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-semibold ${
                          profitRate > 0 ? "text-red-400" :
                          profitRate < 0 ? "text-blue-400" : "text-gray-400"
                        }`}>
                          {formatPercent(profitRate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* ===== Section 4: Detail Modal ===== */}
      {selectedDecision && (() => {
        const decision = selectedDecision
        const stock = getStockInfo(decision.ticker)
        const companyName = decision.company_name || stock?.company_name || (decision as any).name || decision.ticker
        const score = getScore(decision)
        const cls = classifyDecision(decision)
        const decLabel = getDecisionLabel(decision, language)
        const naverUrl = getNaverChartUrl(decision.ticker)
        const profitRate = stock?.profit_rate ?? null
        const buyPrice = stock?.buy_price ?? stock?.avg_price ?? null
        const targetPrice = stock?.target_price ?? ((decision as any).target_price || null)

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedDecision(null)}
          >
            <div
              className="bg-card border border-border/50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-foreground">{companyName}</h2>
                      {decision.is_new_buy && (
                        <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[10px]">NEW</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {naverUrl ? (
                        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                          {decision.ticker}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{decision.ticker}</span>
                      )}
                      {stock?.sector && <Badge variant="outline" className="text-xs">{stock.sector}</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDecision(null)} className="flex-shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Score + Decision */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{language === "ko" ? "점수" : "Score"}</span>
                    <span className={`text-4xl font-bold leading-none ${getBuyScoreColor(score)}`}>{score}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Badge variant="outline" className={`text-sm px-3 py-1 ${getDecisionBadgeClass(cls)}`}>
                    {decLabel}
                  </Badge>
                  {decision.decision_date && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {decision.decision_date}
                      {decision.decision_time ? " " + decision.decision_time.substring(0, 5) : ""}
                    </span>
                  )}
                </div>

                {/* Price grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">{language === "ko" ? "현재가" : "Current"}</p>
                    <p className="font-semibold text-foreground">
                      {decision.current_price ? formatCurrency(decision.current_price) : "-"}
                    </p>
                    {(() => {
                      const changeRate = decision.change_rate ?? stock?.change_rate
                      if (changeRate == null) return null
                      return (
                        <p className={`text-xs mt-0.5 ${changeRate >= 0 ? "text-red-400" : "text-blue-400"}`}>
                          {changeRate >= 0 ? "▲" : "▼"}{Math.abs(changeRate).toFixed(2)}%
                        </p>
                      )
                    })()}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">{language === "ko" ? "매수가" : "Buy Price"}</p>
                    <p className="font-semibold text-foreground">{buyPrice ? formatCurrency(buyPrice) : "-"}</p>
                    {profitRate !== null && (
                      <p className={`text-xs mt-0.5 font-semibold ${
                        profitRate > 0 ? "text-red-400" : profitRate < 0 ? "text-blue-400" : "text-gray-400"
                      }`}>
                        {formatPercent(profitRate)}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">{language === "ko" ? "목표가" : "Target"}</p>
                    <p className="font-semibold text-emerald-400">{targetPrice ? formatCurrency(targetPrice) : "-"}</p>
                    {decision.new_target_price > 0 && (
                      <p className="text-xs text-emerald-400/70 mt-0.5">↑ {formatCurrency(decision.new_target_price)}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">{language === "ko" ? "손절가" : "Stop Loss"}</p>
                    <p className="font-semibold text-blue-400">{stock?.stop_loss ? formatCurrency(stock.stop_loss) : "-"}</p>
                    {decision.new_stop_loss > 0 && (
                      <p className="text-xs text-blue-400/70 mt-0.5">↓ {formatCurrency(decision.new_stop_loss)}</p>
                    )}
                  </div>
                </div>

                {/* AI Rationale */}
                {((decision as any).decision_rationale || (decision as any).analysis_summary) && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      {language === "ko" ? "AI 판단 근거" : "AI Rationale"}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {(decision as any).decision_rationale ?? (decision as any).analysis_summary}
                    </p>
                  </div>
                )}

                {/* Current Strategy */}
                {(decision as any).current_strategy && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      {language === "ko" ? "현재 전략" : "Current Strategy"}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{(decision as any).current_strategy}</p>
                  </div>
                )}

                {/* Technical / Market grid */}
                <div className="grid md:grid-cols-2 gap-3">
                  {decision.technical_trend && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {t("aiDecisions.technicalTrend")}
                      </p>
                      <p className="text-sm text-foreground">{decision.technical_trend}</p>
                    </div>
                  )}
                  {(decision.market_condition_impact || (decision as any).market_impact) && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        {t("aiDecisions.marketImpact")}
                      </p>
                      <p className="text-sm text-foreground">
                        {decision.market_condition_impact ?? (decision as any).market_impact}
                      </p>
                    </div>
                  )}
                  {decision.time_factor && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {t("aiDecisions.timeFactor2")}
                      </p>
                      <p className="text-sm text-foreground">{decision.time_factor}</p>
                    </div>
                  )}
                  {decision.volume_analysis && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        {t("aiDecisions.volumeAnalysis")}
                      </p>
                      <p className="text-sm text-foreground">{decision.volume_analysis}</p>
                    </div>
                  )}
                </div>

                {/* Portfolio adjustment */}
                {decision.portfolio_adjustment_needed === 1 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-400">
                          {t("aiDecisions.portfolioAdjustmentNeeded")}
                        </p>
                        {decision.adjustment_urgency && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs mt-1">
                            {decision.adjustment_urgency}
                          </Badge>
                        )}
                        <p className="text-sm text-foreground mt-1">{decision.adjustment_reason}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-sm text-emerald-400 font-semibold">
                        {t("aiDecisions.maintainStrategy")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
