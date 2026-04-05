"use client"

import React, { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Brain, ChevronDown, ChevronUp, ArrowUpDown, Target, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Clock, BarChart3 } from "lucide-react"
import type { DashboardData, HoldingDecision, Holding, Market } from "@/types/dashboard"
import { useLanguage } from "@/components/language-provider"
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency"
import { MiniCandle } from "@/components/mini-candle"
import { getNaverChartUrl } from "@/lib/naver-chart"

interface AIDecisionsPageProps {
  data: DashboardData
  market?: Market
}

type FilterTab = "all" | "hold" | "buy" | "sell"
type SortKey = "score" | "profit_rate" | "current_price" | "company_name" | "sector"
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

export function AIDecisionsPage({ data, market = "KR" }: AIDecisionsPageProps) {
  const { t, language } = useLanguage()
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
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
        case "current_price":
          return ((a.current_price ?? 0) - (b.current_price ?? 0)) * dir
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

  const toggleRow = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id))
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
      {/* ===== Section 1: Compact Header ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold text-foreground">
            {t("aiDecisions.title")}
          </h2>
        </div>
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
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("company_name")}
              >
                <span className="flex items-center">
                  {language === "ko" ? "종목명" : "Name"}
                  <SortIcon col="company_name" />
                </span>
              </TableHead>
              <TableHead>{language === "ko" ? "코드" : "Code"}</TableHead>
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
                onClick={() => handleSort("current_price")}
              >
                <span className="flex items-center justify-end">
                  {language === "ko" ? "현재가" : "Price"}
                  <SortIcon col="current_price" />
                </span>
              </TableHead>
              <TableHead className="text-right">
                {language === "ko" ? "매수가" : "Buy Price"}
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
              <TableHead className="text-right">
                {language === "ko" ? "목표가" : "Target"}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-center"
                onClick={() => handleSort("score")}
              >
                <span className="flex items-center justify-center">
                  {language === "ko" ? "점수" : "Score"}
                  <SortIcon col="score" />
                </span>
              </TableHead>
              <TableHead className="text-center">
                {language === "ko" ? "판단" : "Decision"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((decision, index) => {
              const stock = getStockInfo(decision.ticker)
              const companyName = decision.company_name || stock?.company_name || (decision as any).name || decision.ticker
              const score = getScore(decision)
              const cls = classifyDecision(decision)
              const decLabel = getDecisionLabel(decision, language)
              const isExpanded = expandedId === (decision.id ?? index)
              const rowId = decision.id ?? index
              const naverUrl = getNaverChartUrl(decision.ticker)
              const profitRate = stock?.profit_rate ?? null
              const buyPrice = stock?.buy_price ?? stock?.avg_price ?? null
              const targetPrice = stock?.target_price ?? ((decision as any).target_price || null)

              return (
                <React.Fragment key={`frag-${rowId}`}>
                  {/* Main row */}
                  <TableRow
                    className="cursor-pointer border-border/30 hover:bg-muted/40"
                    onClick={() => toggleRow(rowId)}
                  >
                    <TableCell className="font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        {companyName}
                        {decision.is_new_buy && (
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[10px] px-1.5 py-0">
                            NEW
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stock?.sector || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {(() => {
                        const change = decision.change ?? stock?.change
                        const changeRate = decision.change_rate ?? stock?.change_rate
                        const hasChange = change != null && !isNaN(change) && changeRate != null && !isNaN(changeRate) && change !== 0
                        const prevClose = hasChange && decision.current_price ? decision.current_price - change : decision.current_price
                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="text-right">
                              <span>{decision.current_price ? formatCurrency(decision.current_price) : "-"}</span>
                              {hasChange && decision.current_price > 0 && (
                                <div className="flex items-center justify-end gap-1 text-[11px]">
                                  {changeRate! >= 0
                                    ? <span className="text-red-400">{"\u25B2"}{Math.abs(change!).toLocaleString()} (+{changeRate!.toFixed(2)}%)</span>
                                    : <span className="text-blue-400">{"\u25BC"}{Math.abs(change!).toLocaleString()} ({changeRate!.toFixed(2)}%)</span>
                                  }
                                </div>
                              )}
                            </div>
                            {decision.current_price > 0 && (
                              <MiniCandle
                                open={prevClose || decision.current_price}
                                close={decision.current_price}
                                high={Math.max(prevClose || decision.current_price, decision.current_price) * 1.02}
                                low={Math.min(prevClose || decision.current_price, decision.current_price) * 0.98}
                              />
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {buyPrice ? formatCurrency(buyPrice) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {profitRate !== null ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={`text-sm font-semibold ${
                              profitRate >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {formatPercent(profitRate)}
                          </span>
                          {(() => {
                            const profitAmount = stock?.profit ?? (
                              stock && stock.current_price != null && (stock.buy_price ?? stock.avg_price) != null && stock.quantity != null
                                ? (stock.current_price - (stock.buy_price ?? stock.avg_price ?? 0)) * stock.quantity
                                : null
                            )
                            if (profitAmount == null || isNaN(profitAmount)) return null
                            return (
                              <span
                                className={`text-xs ${
                                  profitAmount >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                                }`}
                              >
                                ({profitAmount >= 0 ? "+" : ""}{formatCurrency(profitAmount)})
                              </span>
                            )
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-emerald-400">
                      {targetPrice ? formatCurrency(targetPrice) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-7 rounded text-xs font-bold ${getScoreBg(score)}`}
                      >
                        {score}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${getDecisionBadgeClass(cls)}`}>
                        {decLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {/* ===== Section 4: Accordion detail ===== */}
                  {isExpanded && (
                    <TableRow key={`detail-${rowId}`} className="border-border/20 bg-muted/20">
                      <TableCell colSpan={9} className="p-0">
                        <div className="px-6 py-4 space-y-3">
                          {/* Price targets row */}
                          <div className="flex items-center gap-6 text-sm flex-wrap">
                            <div>
                              <span className="text-xs text-muted-foreground mr-1">
                                {language === "ko" ? "목표가" : "Target"}:
                              </span>
                              <span className="font-semibold text-emerald-400">
                                {targetPrice ? formatCurrency(targetPrice) : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground mr-1">
                                {language === "ko" ? "손절가" : "Stop Loss"}:
                              </span>
                              <span className="font-semibold text-red-400">
                                {stock?.stop_loss ? formatCurrency(stock.stop_loss) : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground mr-1">
                                {language === "ko" ? "분석일" : "Date"}:
                              </span>
                              <span className="font-semibold text-foreground">
                                {decision.decision_date} {decision.decision_time ? decision.decision_time.substring(0, 5) : ""}
                              </span>
                            </div>
                            {decision.adjustment_urgency && (
                              <div>
                                <span className="text-xs text-muted-foreground mr-1">
                                  {language === "ko" ? "긴급도" : "Urgency"}:
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    decision.portfolio_adjustment_needed === 1
                                      ? "border-amber-500/50 text-amber-400 text-xs"
                                      : "border-muted text-muted-foreground text-xs"
                                  }
                                >
                                  {decision.adjustment_urgency}
                                </Badge>
                              </div>
                            )}
                            {decision.new_target_price > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground mr-1">
                                  {language === "ko" ? "신규 목표가" : "New Target"}:
                                </span>
                                <span className="font-semibold text-emerald-400 flex items-center gap-1 inline-flex">
                                  <TrendingUp className="w-3 h-3" />
                                  {formatCurrency(decision.new_target_price)}
                                </span>
                              </div>
                            )}
                            {decision.new_stop_loss > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground mr-1">
                                  {language === "ko" ? "신규 손절가" : "New Stop"}:
                                </span>
                                <span className="font-semibold text-red-400 flex items-center gap-1 inline-flex">
                                  <TrendingDown className="w-3 h-3" />
                                  {formatCurrency(decision.new_stop_loss)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* AI Judgment Rationale */}
                          {(decision as any).decision_rationale || (decision as any).analysis_summary ? (
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5" />
                                {language === "ko" ? "AI 판단 근거" : "AI Rationale"}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {(decision as any).decision_rationale ?? (decision as any).analysis_summary}
                              </p>
                            </div>
                          ) : null}

                          {/* Current Strategy */}
                          {(decision as any).current_strategy && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                              <p className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" />
                                {language === "ko" ? "현재 전략" : "Current Strategy"}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {(decision as any).current_strategy}
                              </p>
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
                          {decision.portfolio_adjustment_needed === 1 && (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-semibold text-amber-400">
                                    {t("aiDecisions.portfolioAdjustmentNeeded")}
                                  </p>
                                  <p className="text-sm text-foreground mt-1">{decision.adjustment_reason}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {decision.portfolio_adjustment_needed !== 1 && (
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
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
