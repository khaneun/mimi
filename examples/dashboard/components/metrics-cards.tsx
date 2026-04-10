"use client"

import { TrendingUp, TrendingDown, Wallet, DollarSign, PiggyBank, Zap, Clock } from "lucide-react"
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
  market = "KR"
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

  // Market-specific colors
  const isUSMarket = market === "US"
  const primaryGradient = isUSMarket ? "from-emerald-500/20 to-emerald-500/5" : "from-blue-500/20 to-blue-500/5"
  const secondaryGradient = isUSMarket ? "from-teal-500/20 to-teal-500/5" : "from-indigo-500/20 to-indigo-500/5"
  const sectionGradient = isUSMarket ? "from-emerald-500 to-teal-500" : "from-blue-500 to-indigo-500"
  const sectionTextColor = isUSMarket ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"

  // 현금 비율 계산 (total_cash 사용: D+2 포함 총 현금, fallback으로 deposit)
  const totalCash = rt.total_cash || rt.deposit || 0
  const cashRatio = totalAssets > 0 ? (totalCash / totalAssets) * 100 : 0
  const investmentRatio = 100 - cashRatio

  const realMetrics = [
    {
      label: t("metrics.realTotalAssets"),
      value: formatCurrency(totalAssets),
      change: rt.total_eval_amount > 0
        ? `${language === "ko" ? "평가금액" : "Holdings"} ${formatCurrency(rt.total_eval_amount || 0)}`
        : "",
      changeValue: rt.available_amount > 0
        ? `${t("metrics.deposit")} ${formatCurrency(rt.available_amount)} | ${rt.total_stocks || 0}${t("metrics.stocks")}`
        : `${t("metrics.fullyInvested")} | ${rt.total_stocks || 0}${t("metrics.stocks")}`,
      description: t("metrics.assetsDesc"),
      isPositive: true,
      icon: Wallet,
      gradient: primaryGradient,
    },
    {
      label: t("metrics.realHoldingsProfit"),
      value: formatCurrency(rt.total_profit_amount || 0),
      change: formatPercent(rt.total_profit_rate || 0),
      changeValue: t("metrics.holdingsProfitDesc"),
      description: t("metrics.excludeRealized"),
      isPositive: (rt.total_profit_amount || 0) >= 0,
      icon: (rt.total_profit_amount || 0) >= 0 ? TrendingUp : TrendingDown,
      gradient:
        (rt.total_profit_amount || 0) >= 0
          ? "from-success/20 to-success/5"
          : "from-destructive/20 to-destructive/5",
    },
    {
      label: t("metrics.cashAndStability"),
      value: formatCurrency(totalCash),
      change: `${t("metrics.cashRatio")} ${cashRatio.toFixed(1)}%`,
      changeValue: `${t("metrics.investmentRatio")} ${investmentRatio.toFixed(1)}% | ${rt.total_stocks || 0}${t("metrics.stocks")}`,
      description: t("metrics.cashStabilityDesc"),
      isPositive: cashRatio >= 10,
      icon: PiggyBank,
      gradient: cashRatio >= 20
        ? "from-emerald-500/20 to-emerald-500/5"
        : cashRatio >= 10
          ? "from-yellow-500/20 to-yellow-500/5"
          : "from-orange-500/20 to-orange-500/5",
    },
  ]

  const simulatorMetrics = [
    {
      label: t("metrics.simSoldProfit"),
      value: tradingHistoryCount > 0 ? formatPercent(tradingHistoryTotalProfit) : t("metrics.waitingSell"),
      change: tradingHistoryCount > 0
        ? `${tradingHistoryCount}${t("common.trades")} ${t("metrics.sold")}`
        : t("metrics.onlyHolding"),
      changeValue: tradingHistoryCount > 0
        ? `${tradingHistoryWinCount}${t("metrics.wins")} ${tradingHistoryLossCount}${t("metrics.losses")} (${t("metrics.avgProfit")} ${formatPercent(tradingHistoryAvgProfit)})`
        : t("metrics.updateOnSell"),
      description: t("metrics.soldProfitDesc"),
      isPositive: tradingHistoryCount === 0 || tradingHistoryTotalProfit >= 0,
      icon: DollarSign,
      gradient: "from-purple-500/20 to-purple-500/5",
    },
    {
      label: t("metrics.simAvgHoldingDays"),
      value: tradingHistoryCount > 0 && !isNaN(tradingHistoryAvgDays) ? `${Math.round(tradingHistoryAvgDays)}${t("common.days")}` : `-`,
      change: tradingHistoryCount > 0
        ? `${tradingHistoryCount}${t("metrics.soldBasis")}`
        : t("metrics.waitingSell"),
      changeValue: tradingHistoryCount > 0
        ? `${t("metrics.winRate")} ${tradingHistoryWinRate.toFixed(0)}%`
        : t("metrics.needStrategy"),
      description: t("metrics.avgHoldingDesc"),
      isPositive: true,
      icon: Clock,
      gradient: "from-indigo-500/20 to-indigo-500/5",
    },
    {
      label: t("metrics.simCurrentProfit"),
      value: formatPercent(summary.portfolio.avg_profit_rate || 0),
      change: `${t("metrics.holding")} ${summary.portfolio.total_stocks || 0}${t("metrics.stocks")} (${language === "ko" ? "수익금" : "P&L"} ${formatCurrency(summary.portfolio.total_profit || 0)})`,
      changeValue: `${t("metrics.slotUsage")} ${summary.portfolio.slot_usage ?? "-"}`,
      description: t("metrics.currentProfitDesc"),
      isPositive: (summary.portfolio.total_profit || 0) >= 0,
      icon: Zap,
      gradient: "from-pink-500/20 to-pink-500/5",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Real Trading Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-1 w-8 rounded-full bg-gradient-to-r ${sectionGradient}`} />
            <h2 className="text-sm font-semibold text-muted-foreground">
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {realMetrics.map((metric, index) => {
            const Icon = metric.icon
            return (
              <Card
                key={index}
                className="relative overflow-hidden border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-50`} />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-background/80 backdrop-blur-sm">
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-muted-foreground block">{metric.label}</span>
                        {metric.description && (
                          <span className="text-xs text-muted-foreground/70">{metric.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-sm font-medium ${metric.isPositive ? "text-success" : "text-muted-foreground"}`}>
                        {metric.change}
                      </span>
                      {metric.changeValue && <span className="text-xs text-muted-foreground">{metric.changeValue}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Simulator Section */}
      <div>
        <div className="flex items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              {isUSMarket ? (language === "ko" ? "미국 시뮬레이터" : "US Simulator") : t("metrics.simulator")}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {simulatorMetrics.map((metric, index) => {
            const Icon = metric.icon
            return (
              <Card
                key={index}
                className="relative overflow-hidden border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-50`} />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-background/80 backdrop-blur-sm">
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-muted-foreground block">{metric.label}</span>
                        {metric.description && (
                          <span className="text-xs text-muted-foreground/70">{metric.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-sm font-medium ${metric.isPositive ? "text-success" : "text-muted-foreground"}`}>
                        {metric.change}
                      </span>
                      {metric.changeValue && <span className="text-xs text-muted-foreground">{metric.changeValue}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
