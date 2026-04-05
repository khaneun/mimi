"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Target, ShieldAlert, BarChart3 } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { formatCurrency as formatCurrencyUtil, formatPercent as formatPercentUtil } from "@/lib/currency"
import type { Holding, Market } from "@/types/dashboard"
import { getNaverChartUrl } from "@/lib/naver-chart"

// 전략 배지 색상
const STRATEGY_COLORS: Record<string, string> = {
  "매수": "bg-red-500/15 text-red-400 border-red-500/30",
  "강력매수": "bg-red-600/20 text-red-300 border-red-500/40",
  "매도": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "홀드": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "관망": "bg-gray-500/15 text-gray-400 border-gray-500/30",
  "Buy": "bg-red-500/15 text-red-400 border-red-500/30",
  "Sell": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Hold": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
}

function getStrategyColor(decision: string): string {
  return STRATEGY_COLORS[decision] || "bg-gray-500/15 text-gray-400 border-gray-500/30"
}

// 미니 캔들 컴포넌트
function MiniCandle({ open, close, high, low }: { open: number; close: number; high: number; low: number }) {
  const isUp = close >= open
  const color = isUp ? "#ef4444" : "#3b82f6"  // 한국식: 상승=빨강, 하락=파랑
  const glow = isUp ? "drop-shadow(0 0 3px #ef444488)" : "drop-shadow(0 0 3px #3b82f688)"
  const h = 36 // 전체 높이
  const w = 20 // 전체 너비
  const range = high - low || 1
  const bodyTop = Math.max(open, close)
  const bodyBottom = Math.min(open, close)
  const bodyHeight = Math.max(((bodyTop - bodyBottom) / range) * (h - 4), 6) // 최소 6px
  const bodyY = ((high - bodyTop) / range) * (h - 4) + 2

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" style={{ filter: glow }}>
      {/* 위 꼬리 */}
      <line x1={w/2} y1={2} x2={w/2} y2={bodyY} stroke={color} strokeWidth="1.5" />
      {/* 몸통 */}
      <rect x={3} y={bodyY} width={w - 6} height={bodyHeight} fill={color} rx="2" />
      {/* 아래 꼬리 */}
      <line x1={w/2} y1={bodyY + bodyHeight} x2={w/2} y2={h - 2} stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

interface HoldingsTableProps {
  holdings: Holding[]
  onStockClick: (stock: Holding) => void
  title?: string
  isRealTrading?: boolean
  market?: Market
}

export function HoldingsTable({ holdings, onStockClick, title = "보유 종목", isRealTrading = false, market = "KR" }: HoldingsTableProps) {
  const { language, t } = useLanguage()
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  const isUSMarket = market === "US"

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return isUSMarket ? "$0.00" : "₩0"
    return formatCurrencyUtil(value, market, language as "ko" | "en")
  }

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return "0.00%"
    return formatPercentUtil(value, true)
  }

  const formatWeight = (value: number | undefined) => {
    if (value === undefined || value === null) return "-"
    return `${value.toFixed(2)}%`
  }

  // Market-specific styling
  const cardBorderClass = isRealTrading
    ? (isUSMarket ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20' : 'border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20')
    : ''
  const badgeGradientClass = isUSMarket
    ? "bg-gradient-to-r from-emerald-600 to-teal-600"
    : "bg-gradient-to-r from-blue-600 to-indigo-600"
  const badgeOutlineClass = isUSMarket
    ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
    : "border-blue-500/50 text-blue-600 dark:text-blue-400"
  const simulatorBadgeClass = isUSMarket
    ? "border-teal-500/50 text-teal-600 dark:text-teal-400"
    : "border-purple-500/50 text-purple-600 dark:text-purple-400"

  return (
    <Card className={`border-border/50 ${cardBorderClass}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {isRealTrading ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className={badgeGradientClass}>
                  {isUSMarket ? (language === "ko" ? "미국 실전투자" : "US Real") : t("badge.realTrading")}
                </Badge>
                <Badge variant="outline" className={badgeOutlineClass}>
                  {isUSMarket ? "Season 1" : t("badge.season2")}
                </Badge>
              </div>
            ) : (
              <Badge variant="outline" className={simulatorBadgeClass}>
                {isUSMarket ? (language === "ko" ? "미국 시뮬레이션" : "US Simulation") : t("badge.aiSimulation")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="font-semibold">{t("table.stockName")}</TableHead>
                {!isRealTrading && <TableHead className="font-semibold">{t("table.sector")}</TableHead>}
                {isRealTrading ? (
                  <>
                    <TableHead className="text-right font-semibold">{t("table.quantity")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.avgPrice")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.currentPrice")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.profitRate")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.weight")}</TableHead>
                    <TableHead className="font-semibold">{language === "ko" ? "전략" : "Strategy"}</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right font-semibold">{t("table.buyPrice")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.currentPrice")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.targetPrice")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.profitRate")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("table.holdingDays")}</TableHead>
                    <TableHead className="font-semibold">{language === "ko" ? "전략" : "Strategy"}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => {
                const stockName = holding.company_name || holding.name || t("table.unknown")
                const buyPrice = holding.buy_price || holding.avg_price || 0
                
                return (
                  <React.Fragment key={holding.ticker}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-border/30"
                    onClick={() => onStockClick(holding)}
                  >
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{stockName}</p>
                          {holding.is_new_buy && (
                            <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 animate-pulse">
                              {language === "ko" ? "신규" : "NEW"}
                            </Badge>
                          )}
                        </div>
                        {(() => {
                          const naverUrl = getNaverChartUrl(holding.ticker)
                          return naverUrl ? (
                            <a
                              href={naverUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:underline hover:text-foreground cursor-pointer"
                            >
                              {holding.ticker}
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground">{holding.ticker}</p>
                          )
                        })()}
                      </div>
                    </TableCell>
                    
                    {!isRealTrading && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {holding.sector || holding.scenario?.sector || "-"}
                        </Badge>
                      </TableCell>
                    )}
                    
                    {isRealTrading ? (
                      <>
                        <TableCell className="text-right font-medium">
                          {(holding.quantity || 0).toLocaleString()}{t("common.shares")}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(holding.avg_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const change = holding.change
                            const changeRate = holding.change_rate
                            const hasChange = change != null && !isNaN(change) && changeRate != null && !isNaN(changeRate) && change !== 0
                            const prevClose = hasChange ? holding.current_price - change : holding.current_price
                            return (
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="text-right">
                                  <span className="font-medium">{formatCurrency(holding.current_price)}</span>
                                  {hasChange && (
                                    <div className="flex items-center justify-end gap-1 text-[11px]">
                                      {changeRate! >= 0
                                        ? <span className="text-red-400">{"\u25B2"}{Math.abs(change!).toLocaleString()} (+{changeRate!.toFixed(2)}%)</span>
                                        : <span className="text-blue-400">{"\u25BC"}{Math.abs(change!).toLocaleString()} ({changeRate!.toFixed(2)}%)</span>
                                      }
                                    </div>
                                  )}
                                </div>
                                <MiniCandle
                                  open={prevClose}
                                  close={holding.current_price}
                                  high={Math.max(prevClose, holding.current_price) * 1.02}
                                  low={Math.min(prevClose, holding.current_price) * 0.98}
                                />
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${(holding.profit_rate || 0) >= 0 ? "bg-green-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(Math.abs(holding.profit_rate || 0) * 2, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {(holding.profit_rate || 0) >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-success" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-destructive" />
                              )}
                              <span className={`font-semibold ${(holding.profit_rate || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                                {formatPercent(holding.profit_rate)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatWeight(holding.weight)}
                        </TableCell>
                        <TableCell>
                          {holding.scenario?.decision ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedTicker(expandedTicker === holding.ticker ? null : holding.ticker) }}
                              className="flex items-center gap-1.5 group"
                            >
                              <Badge variant="outline" className={`text-xs ${getStrategyColor(holding.scenario.decision)}`}>
                                {holding.scenario.decision}
                              </Badge>
                              {expandedTicker === holding.ticker
                                ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                : <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                              }
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(buyPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const change = holding.change
                            const changeRate = holding.change_rate
                            const hasChange = change != null && !isNaN(change) && changeRate != null && !isNaN(changeRate) && change !== 0
                            const prevClose = hasChange ? holding.current_price - change : holding.current_price
                            return (
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="text-right">
                                  <span className="font-medium">{formatCurrency(holding.current_price)}</span>
                                  {hasChange && (
                                    <div className="flex items-center justify-end gap-1 text-[11px]">
                                      {changeRate! >= 0
                                        ? <span className="text-red-400">{"\u25B2"}{Math.abs(change!).toLocaleString()} (+{changeRate!.toFixed(2)}%)</span>
                                        : <span className="text-blue-400">{"\u25BC"}{Math.abs(change!).toLocaleString()} ({changeRate!.toFixed(2)}%)</span>
                                      }
                                    </div>
                                  )}
                                </div>
                                <MiniCandle
                                  open={prevClose}
                                  close={holding.current_price}
                                  high={Math.max(prevClose, holding.current_price) * 1.02}
                                  low={Math.min(prevClose, holding.current_price) * 0.98}
                                />
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(holding.target_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${(holding.profit_rate || 0) >= 0 ? "bg-green-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(Math.abs(holding.profit_rate || 0) * 2, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {(holding.profit_rate || 0) >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-success" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-destructive" />
                              )}
                              <span className={`font-semibold ${(holding.profit_rate || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                                {formatPercent(holding.profit_rate)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {holding.holding_days || 0}{t("common.days")}
                        </TableCell>
                        <TableCell>
                          {holding.scenario?.decision ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedTicker(expandedTicker === holding.ticker ? null : holding.ticker) }}
                              className="flex items-center gap-1.5 group"
                            >
                              <Badge variant="outline" className={`text-xs ${getStrategyColor(holding.scenario.decision)}`}>
                                {holding.scenario.decision}
                              </Badge>
                              {expandedTicker === holding.ticker
                                ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                : <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                              }
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                  {/* 전략 분석 상세 (확장 행) */}
                  {expandedTicker === holding.ticker && holding.scenario && (
                    <TableRow className="bg-muted/20 hover:bg-muted/30 border-border/20">
                      <TableCell colSpan={isRealTrading ? 7 : 7} className="p-0">
                        <div className="px-4 py-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
                          {/* 전략 요약 바 */}
                          <div className="flex flex-wrap items-center gap-3">
                            {holding.scenario.decision && (
                              <Badge variant="outline" className={`${getStrategyColor(holding.scenario.decision)} px-3 py-1`}>
                                {holding.scenario.decision}
                              </Badge>
                            )}
                            {holding.scenario.buy_score != null && (
                              <div className="flex items-center gap-1 text-xs">
                                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-muted-foreground">{language === "ko" ? "매수점수" : "Score"}:</span>
                                <span className={`font-bold ${(holding.scenario.buy_score ?? 0) >= 70 ? "text-green-400" : (holding.scenario.buy_score ?? 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                                  {holding.scenario.buy_score}
                                </span>
                              </div>
                            )}
                            {holding.scenario.target_price && (
                              <div className="flex items-center gap-1 text-xs">
                                <Target className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-muted-foreground">{language === "ko" ? "목표" : "Target"}:</span>
                                <span className="font-semibold text-green-400">{formatCurrency(holding.scenario.target_price)}</span>
                              </div>
                            )}
                            {holding.scenario.stop_loss && (
                              <div className="flex items-center gap-1 text-xs">
                                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-muted-foreground">{language === "ko" ? "손절" : "Stop"}:</span>
                                <span className="font-semibold text-red-400">{formatCurrency(holding.scenario.stop_loss)}</span>
                              </div>
                            )}
                            {holding.scenario.sector && (
                              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                {holding.scenario.sector}
                              </Badge>
                            )}
                          </div>

                          {/* 분석 내용 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {holding.scenario.portfolio_analysis && (
                              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                                <p className="text-[10px] font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">
                                  {language === "ko" ? "포트폴리오 분석" : "Portfolio Analysis"}
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{holding.scenario.portfolio_analysis}</p>
                              </div>
                            )}
                            {holding.scenario.sector_outlook && (
                              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                                <p className="text-[10px] font-semibold text-emerald-400 mb-1.5 uppercase tracking-wider">
                                  {language === "ko" ? "섹터 전망" : "Sector Outlook"}
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{holding.scenario.sector_outlook}</p>
                              </div>
                            )}
                          </div>

                          {/* 전략 사유 */}
                          {holding.scenario.rationale && (
                            <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20">
                              <p className="text-[10px] font-semibold text-amber-400 mb-1.5 uppercase tracking-wider">
                                {language === "ko" ? "AI 전략 사유" : "AI Strategy Rationale"}
                              </p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{holding.scenario.rationale}</p>
                            </div>
                          )}

                          {/* 시장 환경 */}
                          {holding.scenario.market_condition && (
                            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                              <p className="text-[10px] font-semibold text-cyan-400 mb-1.5 uppercase tracking-wider">
                                {language === "ko" ? "시장 환경" : "Market Condition"}
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{holding.scenario.market_condition}</p>
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
        </div>
      </CardContent>
    </Card>
  )
}
