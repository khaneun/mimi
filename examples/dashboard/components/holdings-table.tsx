"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { formatPercent as formatPercentUtil } from "@/lib/currency"
import type { Holding, Market } from "@/types/dashboard"
import { getNaverChartUrl } from "@/lib/naver-chart"

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

interface HoldingsTableProps {
  holdings: Holding[]
  onStockClick: (stock: Holding) => void
  title?: string
  isRealTrading?: boolean
  market?: Market
}

export function HoldingsTable({ holdings, onStockClick, title = "보유 종목", isRealTrading = false, market = "KR" }: HoldingsTableProps) {
  const { language, t } = useLanguage()
  const isUSMarket = market === "US"

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return "0.00%"
    return formatPercentUtil(value, true)
  }

  const cardBorderClass = isRealTrading
    ? (isUSMarket
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20"
        : "border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20")
    : ""
  const badgeGradientClass = isUSMarket
    ? "bg-gradient-to-r from-emerald-600 to-teal-600"
    : "bg-gradient-to-r from-blue-600 to-indigo-600"
  const simulatorBadgeClass = isUSMarket
    ? "border-teal-500/50 text-teal-600 dark:text-teal-400"
    : "border-purple-500/50 text-purple-600 dark:text-purple-400"

  return (
    <Card className={`border-border/50 ${cardBorderClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {isRealTrading ? (
            <Badge variant="default" className={badgeGradientClass}>
              {isUSMarket ? (language === "ko" ? "미국 실전투자" : "US Real") : t("badge.realTrading")}
            </Badge>
          ) : (
            <Badge variant="outline" className={simulatorBadgeClass}>
              {isUSMarket ? (language === "ko" ? "미국 시뮬레이션" : "US Simulation") : t("badge.aiSimulation")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="font-semibold w-16">{language === "ko" ? "판단" : "Decision"}</TableHead>
                <TableHead className="font-semibold">{t("table.stockName")}</TableHead>
                <TableHead className="font-semibold">{t("table.sector")}</TableHead>
                <TableHead className="text-right font-semibold">{t("table.profitRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => {
                const stockName = holding.company_name || holding.name || t("table.unknown")
                const sector = holding.sector || holding.scenario?.sector || "-"
                const strategy = holding.scenario?.decision

                return (
                  <TableRow
                    key={holding.ticker}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-border/30"
                    onClick={() => onStockClick(holding)}
                  >
                    <TableCell>
                      {strategy ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${STRATEGY_COLORS[strategy] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}
                        >
                          {strategy}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{stockName}</p>
                          {holding.is_new_buy && (
                            <Badge
                              variant="default"
                              className="text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 animate-pulse"
                            >
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
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{sector}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(holding.profit_rate || 0) > 0 ? (
                          <TrendingUp className="w-3 h-3 text-red-400" />
                        ) : (holding.profit_rate || 0) < 0 ? (
                          <TrendingDown className="w-3 h-3 text-blue-400" />
                        ) : null}
                        <span className={`font-semibold ${
                          (holding.profit_rate || 0) > 0 ? "text-red-400" :
                          (holding.profit_rate || 0) < 0 ? "text-blue-400" : "text-gray-400"
                        }`}>
                          {formatPercent(holding.profit_rate)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
