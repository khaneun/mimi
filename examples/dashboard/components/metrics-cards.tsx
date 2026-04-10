"use client"

import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/components/language-provider"
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency"
import type { Summary, Market } from "@/types/dashboard"

interface MetricsCardsProps {
  summary: Summary
  kisPortfolio?: { summary: any; stocks: any[] } | null
  kisMode?: string
  realPortfolio?: Array<{
    profit_rate: number
    name?: string
    profit?: number
  }>
  tradingHistoryCount?: number
  tradingHistoryTotalProfit?: number
  tradingHistoryAvgProfit?: number
  tradingHistoryAvgDays?: number
  tradingHistoryWinRate?: number
  tradingHistoryWinCount?: number
  tradingHistoryLossCount?: number
  market?: Market
  kisLoading?: boolean
}

export function MetricsCards({
  summary,
  kisPortfolio,
  kisMode,
  realPortfolio = [],
  tradingHistoryCount = 0,
  tradingHistoryTotalProfit = 0,
  tradingHistoryAvgProfit = 0,
  tradingHistoryAvgDays = 0,
  tradingHistoryWinRate = 0,
  tradingHistoryWinCount = 0,
  tradingHistoryLossCount = 0,
  market = "KR",
  kisLoading = false
}: MetricsCardsProps) {
  const { language, t } = useLanguage()

  const formatCurrency = (value: number) => {
    return formatCurrencyUtil(value, market, language as "ko" | "en")
  }

  const formatPercent = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "0.00%"
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
  }

  // KIS 데이터 우선 사용, 없으면 dashboard_data fallback
  const rt = kisPortfolio?.summary ?? summary.real_trading

  // 총 자산 계산 (평가금액 + 예수금)
  const totalAssets = (rt.total_eval_amount || 0) +
                      (rt.available_amount || 0)

  // Market-specific
  const isUSMarket = market === "US"

  // 현금 비율 계산 (total_cash 사용: D+2 포함 총 현금, fallback으로 deposit)
  const totalCash = rt.total_cash || rt.deposit || 0
  const cashRatio = totalAssets > 0 ? (totalCash / totalAssets) * 100 : 0
  const investmentRatio = 100 - cashRatio

  const isRealProfit = (rt.total_profit_amount || 0) >= 0

  return (
    <div className="space-y-5">
      {/* Real Trading Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-bold text-foreground">
            {isUSMarket ? (language === "ko" ? "미국 실전투자" : "US Real Trading") : t("metrics.realTrading")}
          </h2>
          {kisMode === "paper" ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {language === "ko" ? "모의투자" : "Paper"}
            </span>
          ) : kisMode === "real" ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {language === "ko" ? "실전투자" : "Live"}
            </span>
          ) : null}
        </div>
        <div className="relative">
          {kisLoading && (
            <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{language === "ko" ? "KIS 조회 중..." : "Fetching..."}</span>
              </div>
            </div>
          )}
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="grid grid-cols-3 divide-x divide-border/40">
                {/* 총자산 */}
                <div className="pr-5">
                  <p className="text-xs text-muted-foreground mb-2">{t("metrics.realTotalAssets")}</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAssets)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {language === "ko" ? "평가" : "Holdings"} {formatCurrency(rt.total_eval_amount || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("metrics.deposit")} {formatCurrency(totalCash)} · {rt.total_stocks || 0}{t("metrics.stocks")}
                  </p>
                </div>
                {/* 평가손익 */}
                <div className="px-5">
                  <p className="text-xs text-muted-foreground mb-2">{t("metrics.realHoldingsProfit")}</p>
                  <p className={`text-2xl font-bold ${isRealProfit ? "text-red-400" : "text-blue-400"}`}>
                    {formatCurrency(rt.total_profit_amount || 0)}
                  </p>
                  <p className={`text-sm font-semibold mt-2 ${isRealProfit ? "text-red-400" : "text-blue-400"}`}>
                    {formatPercent(rt.total_profit_rate || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("metrics.excludeRealized")}</p>
                </div>
                {/* 현금&안정성 */}
                <div className="pl-5">
                  <p className="text-xs text-muted-foreground mb-2">{t("metrics.cashAndStability")}</p>
                  <p className="text-2xl font-bold text-foreground">{cashRatio.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {language === "ko" ? "현금" : "Cash"} {formatCurrency(totalCash)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("metrics.investmentRatio")} {investmentRatio.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Simulator Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-bold text-foreground">
            {isUSMarket ? (language === "ko" ? "미국 시뮬레이터" : "US Simulator") : t("metrics.simulator")}
          </h2>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="grid grid-cols-3 divide-x divide-border/40">
              {/* 매도 수익 */}
              <div className="pr-5">
                <p className="text-xs text-muted-foreground mb-2">{t("metrics.simSoldProfit")}</p>
                <p className="text-2xl font-bold text-foreground">
                  {tradingHistoryCount > 0 ? formatPercent(tradingHistoryTotalProfit) : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {tradingHistoryCount > 0
                    ? `${tradingHistoryCount}${t("common.trades")} ${t("metrics.sold")}`
                    : t("metrics.onlyHolding")}
                </p>
                {tradingHistoryCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tradingHistoryWinCount}{t("metrics.wins")} {tradingHistoryLossCount}{t("metrics.losses")} · {language === "ko" ? "평균" : "avg"} {formatPercent(tradingHistoryAvgProfit)}
                  </p>
                )}
              </div>
              {/* 평균 보유 기간 */}
              <div className="px-5">
                <p className="text-xs text-muted-foreground mb-2">{t("metrics.simAvgHoldingDays")}</p>
                <p className="text-2xl font-bold text-foreground">
                  {tradingHistoryCount > 0 && !isNaN(tradingHistoryAvgDays)
                    ? `${Math.round(tradingHistoryAvgDays)}${t("common.days")}`
                    : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {tradingHistoryCount > 0
                    ? `${t("metrics.winRate")} ${tradingHistoryWinRate.toFixed(0)}%`
                    : t("metrics.waitingSell")}
                </p>
              </div>
              {/* 현재 수익 */}
              <div className="pl-5">
                <p className="text-xs text-muted-foreground mb-2">{t("metrics.simCurrentProfit")}</p>
                <p className={`text-2xl font-bold ${(summary.portfolio.total_profit || 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {formatPercent(summary.portfolio.avg_profit_rate || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("metrics.holding")} {summary.portfolio.total_stocks || 0}{t("metrics.stocks")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ko" ? "수익금" : "P&L"} {formatCurrency(summary.portfolio.total_profit || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
