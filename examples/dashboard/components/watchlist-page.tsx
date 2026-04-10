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
import { Eye, ChevronDown, ChevronUp, ArrowUpDown, Clock } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency"
import { MiniCandle } from "@/components/mini-candle"
import type { WatchlistStock, Market } from "@/types/dashboard"
import { getNaverChartUrl } from "@/lib/naver-chart"

interface WatchlistPageProps {
  watchlist: WatchlistStock[]
  market?: Market
}

type FilterTab = "all" | "new_buy" | "buy" | "hold" | "sell"
type SortKey = "buy_score" | "upside" | "current_price" | "company_name" | "sector"
type SortDir = "asc" | "desc"

function classifyDecision(decision: string): "buy" | "hold" | "sell" {
  const d = decision?.toLowerCase() ?? ""
  if (d.includes("매수") || d.includes("적극")) return "buy"
  if (d.includes("매도")) return "sell"
  return "hold"
}

function getUpside(stock: WatchlistStock): number | null {
  if (!stock.target_price || !stock.current_price) return null
  return ((stock.target_price - stock.current_price) / stock.current_price) * 100
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400"
  if (score >= 60) return "bg-emerald-500/10 text-emerald-300"
  if (score >= 40) return "bg-amber-500/10 text-amber-400"
  return "bg-red-500/15 text-red-400"
}

function getDecisionBadge(decision: string): { className: string; label: string } {
  const cls = classifyDecision(decision)
  if (cls === "buy")
    return {
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      label: decision,
    }
  if (cls === "sell")
    return {
      className: "bg-red-500/20 text-red-400 border-red-500/30",
      label: decision,
    }
  return {
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    label: decision || "관망",
  }
}

export function WatchlistPage({ watchlist, market = "KR" }: WatchlistPageProps) {
  const { t, language } = useLanguage()
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("buy_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const formatCurrency = (value: number) =>
    formatCurrencyUtil(value, market, language as "ko" | "en")

  // --- counts ---
  const buyCount = watchlist.filter((s) => classifyDecision(s.decision) === "buy").length
  const holdCount = watchlist.filter((s) => classifyDecision(s.decision) === "hold").length
  const sellCount = watchlist.filter((s) => classifyDecision(s.decision) === "sell").length
  const newBuyCount = watchlist.filter((s) => s.is_new_buy).length
  const avgScore =
    watchlist.length > 0
      ? watchlist.reduce((sum, s) => sum + s.buy_score, 0) / watchlist.length
      : 0

  // --- filter ---
  const filtered = useMemo(() => {
    let list = watchlist
    switch (activeFilter) {
      case "new_buy":
        list = watchlist.filter((s) => s.is_new_buy)
        break
      case "buy":
        list = watchlist.filter((s) => classifyDecision(s.decision) === "buy")
        break
      case "hold":
        list = watchlist.filter((s) => classifyDecision(s.decision) === "hold")
        break
      case "sell":
        list = watchlist.filter((s) => classifyDecision(s.decision) === "sell")
        break
    }
    return list
  }, [watchlist, activeFilter])

  // --- sort ---
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      switch (sortKey) {
        case "buy_score":
          return (a.buy_score - b.buy_score) * dir
        case "upside":
          return ((getUpside(a) ?? -999) - (getUpside(b) ?? -999)) * dir
        case "current_price":
          return ((a.current_price ?? 0) - (b.current_price ?? 0)) * dir
        case "company_name":
          return (a.company_name ?? "").localeCompare(b.company_name ?? "") * dir
        case "sector":
          return (a.sector ?? "").localeCompare(b.sector ?? "") * dir
        default:
          return 0
      }
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const toggleRow = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: language === "ko" ? "전체" : "All", count: watchlist.length },
    { key: "new_buy", label: language === "ko" ? "신규 매수" : "New Buy", count: newBuyCount, isNew: true },
    { key: "buy", label: language === "ko" ? "매수" : "Buy", count: buyCount },
    { key: "hold", label: language === "ko" ? "관망" : "Hold", count: holdCount },
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
  if (watchlist.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-12 text-center">
          <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">{t("watchlist.noData")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ===== Section 1: Compact Header ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {language === "ko" ? "전체" : "Total"} {watchlist.length}
          </Badge>
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {language === "ko" ? "매수" : "Buy"} {buyCount}
          </Badge>
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
            {language === "ko" ? "관망" : "Hold"} {holdCount}
          </Badge>
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
            {language === "ko" ? "매도" : "Sell"} {sellCount}
          </Badge>
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
            {language === "ko" ? "평균" : "Avg"} {avgScore.toFixed(1)}{language === "ko" ? "점" : "pt"}
          </Badge>
          {(() => {
            const dates = watchlist.map(w => w.analyzed_date).filter(Boolean).sort().reverse()
            const latest = dates[0]
            return latest ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                <Clock className="w-3 h-3" />
                {language === "ko" ? "분석" : "Analyzed"}: {latest}
              </span>
            ) : null
          })()}
        </div>
      </div>

      {/* ===== Section 2: Filter Tabs ===== */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterTabs.map((tab: any) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === tab.key
                ? tab.isNew
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-primary text-primary-foreground"
                : tab.isNew
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.isNew && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Section 3: Stock Table ===== */}
      <div className="relative">
        {/* Mobile scroll hint gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />
        <div className="text-xs text-muted-foreground text-right mb-1 md:hidden flex items-center justify-end gap-1">
          <span>{language === "ko" ? "스크롤" : "Scroll"}</span>
          <span>&rarr;</span>
        </div>
      <Card className="border-border/50 overflow-x-auto">
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
                {language === "ko" ? "목표가" : "Target"}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("upside")}
              >
                <span className="flex items-center justify-end">
                  {language === "ko" ? "상승여력" : "Upside"}
                  <SortIcon col="upside" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-center"
                onClick={() => handleSort("buy_score")}
              >
                <span className="flex items-center justify-center">
                  {language === "ko" ? "점수" : "Score"}
                  <SortIcon col="buy_score" />
                </span>
              </TableHead>
              <TableHead className="text-center">
                {language === "ko" ? "판단" : "Decision"}
              </TableHead>
              <TableHead className="text-center">
                {language === "ko" ? "소스" : "Source"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((stock, index) => {
              const upside = getUpside(stock)
              const decBadge = getDecisionBadge(stock.decision)
              const isExpanded = expandedId === (stock.id ?? index)
              const rowId = stock.id ?? index
              const naverUrl = getNaverChartUrl(stock.ticker)

              return (
                <React.Fragment key={`frag-${rowId}`}>
                  {/* Main row */}
                  <TableRow
                    className="cursor-pointer border-border/30 hover:bg-muted/40"
                    onClick={() => toggleRow(rowId)}
                  >
                    <TableCell className="font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        {stock.company_name || stock.ticker}
                        {stock.is_new_buy && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                            </span>
                            NEW
                          </span>
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
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:underline"
                        >
                          {stock.ticker}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{stock.ticker}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stock.sector || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {(() => {
                        const change = stock.change
                        const changeRate = stock.change_rate
                        const hasChange = change != null && !isNaN(change) && changeRate != null && !isNaN(changeRate) && change !== 0
                        const prevClose = hasChange ? stock.current_price - change : stock.current_price
                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="text-right">
                              <span>{stock.current_price ? formatCurrency(stock.current_price) : "-"}</span>
                              {hasChange && stock.current_price > 0 && (
                                <div className="flex items-center justify-end gap-1 text-[11px]">
                                  {changeRate! >= 0
                                    ? <span className="text-red-400">{"\u25B2"}{Math.abs(change!).toLocaleString()} (+{changeRate!.toFixed(2)}%)</span>
                                    : <span className="text-blue-400">{"\u25BC"}{Math.abs(change!).toLocaleString()} ({changeRate!.toFixed(2)}%)</span>
                                  }
                                </div>
                              )}
                            </div>
                            {stock.current_price > 0 && (
                              <MiniCandle
                                open={prevClose}
                                close={stock.current_price}
                                high={Math.max(prevClose, stock.current_price) * 1.02}
                                low={Math.min(prevClose, stock.current_price) * 0.98}
                              />
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-emerald-400">
                      {stock.target_price ? formatCurrency(stock.target_price) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {upside !== null ? (
                        <span
                          className={`text-sm font-semibold ${
                            upside > 0 ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {upside > 0 ? "+" : ""}
                          {upside.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-7 rounded text-xs font-bold ${getScoreBg(
                          stock.buy_score
                        )}`}
                      >
                        {stock.buy_score}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${decBadge.className}`}>
                        {decBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {stock.rationale?.includes("인베스팅") ? (
                        <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/30">
                          {language === "ko" ? "인베스팅" : "Investing"}
                        </Badge>
                      ) : stock.rationale?.includes("신규 매수") ? (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30">
                          {language === "ko" ? "AI 분석" : "AI Analysis"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30">
                          MarketPulse
                        </Badge>
                      )}
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
                                {stock.target_price ? formatCurrency(stock.target_price) : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground mr-1">
                                {language === "ko" ? "손절가" : "Stop Loss"}:
                              </span>
                              <span className="font-semibold text-red-400">
                                {stock.stop_loss ? formatCurrency(stock.stop_loss) : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground mr-1">
                                {language === "ko" ? "투자기간" : "Period"}:
                              </span>
                              <span className="font-semibold text-foreground">
                                {stock.investment_period || "-"}
                              </span>
                            </div>
                            {(stock.scenario?.max_portfolio_size || stock.max_portfolio_size) && (
                              <div>
                                <span className="text-xs text-muted-foreground mr-1">
                                  {language === "ko" ? "최대 포트 비중" : "Max Weight"}:
                                </span>
                                <span className="font-semibold text-foreground">
                                  {stock.scenario?.max_portfolio_size || stock.max_portfolio_size}
                                  {language === "ko" ? "종목" : " stocks"}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* AI Rationale */}
                          {(stock.rationale || stock.skip_reason) && (
                            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                              <p className="text-xs font-semibold text-primary mb-1">
                                {language === "ko" ? "AI 판단 사유" : "AI Rationale"}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {stock.rationale || stock.skip_reason}
                              </p>
                            </div>
                          )}

                          {/* Portfolio Analysis */}
                          {stock.portfolio_analysis && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                {t("modal.portfolioAnalysis")}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {stock.portfolio_analysis}
                              </p>
                            </div>
                          )}

                          {/* Sector Outlook */}
                          {stock.sector_outlook && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                {t("modal.sectorOutlook")}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {stock.sector_outlook}
                              </p>
                            </div>
                          )}

                          {/* Market Condition */}
                          {stock.market_condition && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                {t("modal.marketCondition")}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {stock.market_condition}
                              </p>
                            </div>
                          )}

                          {/* Valuation Analysis */}
                          {stock.valuation_analysis && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                {t("modal.valuationAnalysis")}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {stock.valuation_analysis}
                              </p>
                            </div>
                          )}

                          {/* Trading Scenarios */}
                          {(() => {
                            const ts = stock.scenario?.trading_scenarios || stock.trading_scenarios
                            if (!ts) return null
                            return (
                              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs font-semibold text-blue-400 mb-2">
                                  {t("modal.tradingScenarios")}
                                </p>
                                <div className="space-y-2">
                                  {ts.key_levels && typeof ts.key_levels === "object" && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {Object.entries(ts.key_levels).map(([key, value]) => (
                                        <div
                                          key={key}
                                          className="p-2 rounded bg-background/50 border border-border/30"
                                        >
                                          <p className="text-[10px] text-muted-foreground">{key}</p>
                                          <p className="text-xs font-semibold text-foreground">
                                            {String(value)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {ts.sell_triggers &&
                                    Array.isArray(ts.sell_triggers) &&
                                    ts.sell_triggers.length > 0 && (
                                      <div>
                                        <p className="text-[10px] text-muted-foreground mb-1">
                                          {t("modal.sellTriggers")}
                                        </p>
                                        <ul className="space-y-0.5">
                                          {ts.sell_triggers.map((trigger: string, idx: number) => (
                                            <li
                                              key={idx}
                                              className="text-xs text-foreground flex items-start gap-1.5"
                                            >
                                              <span className="text-red-400">•</span>
                                              {trigger}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  {ts.hold_conditions &&
                                    Array.isArray(ts.hold_conditions) &&
                                    ts.hold_conditions.length > 0 && (
                                      <div>
                                        <p className="text-[10px] text-muted-foreground mb-1">
                                          {t("modal.holdConditions")}
                                        </p>
                                        <ul className="space-y-0.5">
                                          {ts.hold_conditions.map(
                                            (condition: string, idx: number) => (
                                              <li
                                                key={idx}
                                                className="text-xs text-foreground flex items-start gap-1.5"
                                              >
                                                <span className="text-emerald-400">•</span>
                                                {condition}
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  {ts.portfolio_context && (
                                    <p className="text-xs text-foreground">
                                      {ts.portfolio_context}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
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
    </div>
  )
}
