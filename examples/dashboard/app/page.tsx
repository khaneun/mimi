"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { OperatingCostsCard } from "@/components/operating-costs-card"
import { MetricsCards } from "@/components/metrics-cards"
import { HoldingsTable } from "@/components/holdings-table"
import { PerformanceChart } from "@/components/performance-chart"
import { AIDecisionsPage } from "@/components/ai-decisions-page"
import { TradingHistoryPage } from "@/components/trading-history-page"
import { WatchlistPage } from "@/components/watchlist-page"
import { TradingInsightsPage } from "@/components/trading-insights-page"
import { ReportsPage } from "@/components/reports-page"
import { NewsPage } from "@/components/news-page"
import { PortfolioPage } from "@/components/portfolio-page"
import { AgentsPage } from "@/components/agents-page"
import { ExecutionPage } from "@/components/execution-page"
import { SettingsPage } from "@/components/settings-page"
import { StockDetailModal } from "@/components/stock-detail-modal"
import { ProjectFooter } from "@/components/project-footer"
import { useLanguage } from "@/components/language-provider"
import { useMarket } from "@/components/market-selector"
import { TriggerReliabilityBadge } from "@/components/trigger-reliability-badge"
import { formatCurrency } from "@/lib/currency"
import type { DashboardData, Holding, Market } from "@/types/dashboard"

type TabType = "dashboard" | "ai-decisions" | "trading" | "watchlist" | "insights" | "portfolio" | "news" | "jeoningu-lab" | "agents" | "execution" | "settings" | "costs"
const VALID_TABS: TabType[] = ["dashboard", "ai-decisions", "trading", "watchlist", "insights", "portfolio", "news", "jeoningu-lab", "agents", "execution", "settings", "costs"]

// Get data file path based on market and language
function getDataFilePath(market: Market, language: string): string {
  if (market === "US") {
    return language === "en" ? "/us_dashboard_data_en.json" : "/us_dashboard_data.json"
  } else {
    return language === "en" ? "/dashboard_data_en.json" : "/dashboard_data.json"
  }
}

// Suspense 경계를 위한 로딩 컴포넌트
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

// 메인 대시보드 컴포넌트 (useSearchParams 사용)
function DashboardContent() {
  const { language, t } = useLanguage()
  const [market, setMarket] = useMarket()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [selectedStock, setSelectedStock] = useState<Holding | null>(null)
  const [isRealTrading, setIsRealTrading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [lastFetchTime, setLastFetchTime] = useState<string>("")
  const prevDataHash = useRef<string>("")
  const [kisPortfolio, setKisPortfolio] = useState<{ summary: any; stocks: any[]; mode?: string } | null>(null)

  // URL에서 탭 파라미터 읽기
  const tabParam = searchParams.get("tab") as TabType | null
  const activeTab: TabType = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dashboard"

  // 탭 변경 시 URL 업데이트
  const handleTabChange = (tab: TabType) => {
    // Jeoningu Lab is only available for KR market
    if (tab === "jeoningu-lab" && market === "US") {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "dashboard") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const queryString = params.toString()
    router.push(queryString ? `?${queryString}` : "/", { scroll: false })
  }

  // Handle market change
  const handleMarketChange = (newMarket: Market) => {
    setMarket(newMarket)
    // Reset tab to dashboard if current tab is jeoningu-lab and switching to US
    if (activeTab === "jeoningu-lab" && newMarket === "US") {
      handleTabChange("dashboard")
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataError(null)
        const dataFile = getDataFilePath(market, language)
        const response = await fetch(`${dataFile}?t=${Date.now()}`)

        if (!response.ok) {
          // US data file might not exist yet
          if (market === "US" && response.status === 404) {
            setDataError(language === "ko"
              ? "미국 시장 데이터가 아직 없습니다. 곧 추가될 예정입니다."
              : "US market data is not available yet. Coming soon."
            )
            setData(null)
            return
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const jsonData = await response.json()
        // 데이터가 실제로 변경된 경우에만 state 업데이트 (포커스/스크롤 유지)
        const hash = jsonData.generated_at || ""
        if (hash !== prevDataHash.current) {
          prevDataHash.current = hash
          setData(jsonData)
        }
        setLastFetchTime(new Date().toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }))
      } catch (error) {
        console.error("[v0] Failed to fetch dashboard data:", error)
        if (market === "US") {
          setDataError(language === "ko"
            ? "미국 시장 데이터를 불러올 수 없습니다."
            : "Failed to load US market data."
          )
        }
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 1 * 60 * 1000) // 1분마다 갱신

    return () => clearInterval(interval)
  }, [language, market])

  // KIS 포트폴리오 데이터 로드 (시장 현황 투자 현황 섹션)
  useEffect(() => {
    if (market !== "KR") return
    fetch("/api/portfolio?" + Date.now())
      .then(r => r.json())
      .then(d => {
        const account = d?.accounts?.[0]
        if (account) setKisPortfolio({
          summary: account.summary ?? {},
          stocks: account.stocks ?? [],
          mode: d.kis_mode ?? "paper",
        })
      })
      .catch(() => {})
  }, [market])

  const handleStockClick = (stock: Holding, isReal: boolean) => {
    setSelectedStock(stock)
    setIsRealTrading(isReal)
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          market={market}
          onMarketChange={handleMarketChange}
        />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center p-8 rounded-lg border border-border/50 bg-card max-w-md">
            <div className="text-4xl mb-4">{market === "US" ? "🇺🇸" : "🇰🇷"}</div>
            <p className="text-muted-foreground">{dataError}</p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {language === "ko"
                ? "다른 시장을 선택하거나 나중에 다시 시도해 주세요."
                : "Please select another market or try again later."
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading.text")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        lastUpdated={lastFetchTime}
        market={market}
        onMarketChange={handleMarketChange}
      />

      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* 실시간 시장 지표 배너 */}
            {data.realtime && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                {[
                  { label: 'KOSPI', value: data.realtime.kospi?.value?.toLocaleString(), change: data.realtime.kospi?.change_rate, color: 'blue' },
                  { label: 'KOSDAQ', value: data.realtime.kosdaq?.value?.toLocaleString(), change: data.realtime.kosdaq?.change_rate, color: 'emerald' },
                ].filter(m => m.value).map(m => (
                  <div key={m.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                    <p className={`text-[10px] ${(m.change ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(m.change ?? 0) >= 0 ? '+' : ''}{m.change?.toFixed(2)}%</p>
                  </div>
                ))}
              </div>
            )}

            {/* 트리거 신뢰도 미니 배지 */}
            {data.trading_insights?.trigger_reliability && (
              <TriggerReliabilityBadge
                data={data.trading_insights.trigger_reliability}
                onNavigateToInsights={() => handleTabChange("insights")}
              />
            )}

            {/* 급등주 TOP 5 */}
            {data.top_gainers && data.top_gainers.length > 0 && (
              <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔥</span>
                  <h3 className="text-sm font-bold text-foreground">급등주 TOP 5</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">{data.realtime?.updated_at}</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {data.top_gainers.map((g: any, i: number) => (
                    <div key={g.code ?? i} className="text-center p-3 rounded-lg bg-card/50 border border-border/20 hover:border-red-500/30 transition-colors">
                      <p className="text-xs text-muted-foreground truncate">{g.name}</p>
                      <p className="text-base font-bold text-foreground">{(g.price ?? 0).toLocaleString()}</p>
                      <p className="text-sm font-semibold text-red-400">▲{g.change_rate}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 핵심 지표 카드 */}
            <MetricsCards
              summary={data.summary}
              kisPortfolio={kisPortfolio}
              realPortfolio={data.real_portfolio || []}
              tradingHistoryCount={data.trading_history?.length || 0}
              tradingHistoryTotalProfit={
                data.trading_history?.reduce((sum, trade) => sum + trade.profit_rate, 0) || 0
              }
              tradingHistoryAvgProfit={
                data.trading_history?.length > 0
                  ? data.trading_history.reduce((sum, trade) => sum + trade.profit_rate, 0) / data.trading_history.length
                  : 0
              }
              tradingHistoryAvgDays={
                data.trading_history?.length > 0
                  ? data.trading_history.reduce((sum, trade) => sum + trade.holding_days, 0) / data.trading_history.length
                  : 0
              }
              tradingHistoryWinRate={
                data.trading_history?.length > 0
                  ? (data.trading_history.filter(t => t.profit_rate > 0).length / data.trading_history.length) * 100
                  : 0
              }
              tradingHistoryWinCount={
                data.trading_history?.filter(t => t.profit_rate > 0).length || 0
              }
              tradingHistoryLossCount={
                data.trading_history?.filter(t => t.profit_rate <= 0).length || 0
              }
              market={market}
            />

            {/* 투자 현황 배너 — KIS 우선, fallback: dashboard_data */}
            {(() => {
              const rt = kisPortfolio?.summary ?? data.summary?.real_trading
              if (!rt) return null
              const deposit = rt.deposit ?? 0
              const evalAmount = rt.total_eval_amount ?? 0
              const profitAmount = rt.total_profit_amount ?? 0
              const profitRate = rt.total_profit_rate ?? 0
              const isProfit = profitAmount >= 0
              return (
                <div className={`rounded-xl px-4 py-3 border ${
                  isProfit
                    ? "bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20"
                    : "bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20"
                }`}>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                    <span>💰</span>
                    <span className="font-semibold text-muted-foreground">{language === "ko" ? "투자 현황" : "Portfolio"}</span>
                    <span>{language === "ko" ? "예수금" : "Deposit"} {formatCurrency(deposit, market, language as "ko" | "en")}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{language === "ko" ? "평가금" : "Valuation"} {formatCurrency(evalAmount, market, language as "ko" | "en")}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className={isProfit ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                      {formatCurrency(profitAmount, market, language as "ko" | "en")} ({profitRate >= 0 ? "+" : ""}{(profitRate ?? 0).toFixed(2)}%)
                    </span>
                  </p>
                </div>
              )
            })()}

            {/* 투자 현황 종목 테이블 — KIS 우선 */}
            {kisPortfolio && kisPortfolio.stocks.length > 0 && (
              <HoldingsTable
                holdings={kisPortfolio.stocks.map((s: any) => ({
                  ticker: s.code,
                  name: s.name,
                  current_price: s.current_price ?? 0,
                  avg_price: s.avg_price ?? 0,
                  quantity: s.quantity ?? 0,
                  profit_rate: s.profit_rate ?? 0,
                  profit: s.profit_amount ?? 0,
                  sector: s.sector ?? "기타",
                }))}
                onStockClick={(stock) => handleStockClick(stock, true)}
                title={t("table.realPortfolio")}
                isRealTrading={true}
                market={market}
              />
            )}
            {(!kisPortfolio || kisPortfolio.stocks.length === 0) && data.real_portfolio && data.real_portfolio.length > 0 && (
              <HoldingsTable
                holdings={data.real_portfolio}
                onStockClick={(stock) => handleStockClick(stock, true)}
                title={t("table.realPortfolio")}
                isRealTrading={true}
                market={market}
              />
            )}

            {/* 프리즘 시뮬레이터 */}
            <HoldingsTable
              holdings={data.holdings ?? []}
              onStockClick={(stock) => handleStockClick(stock, false)}
              title={t("table.simulator")}
              isRealTrading={false}
              market={market}
            />

            {/* 시장 지수 차트 - 하단 배치 */}
            <PerformanceChart
              data={data.market_condition ?? []}
              prismPerformance={data.prism_performance ?? []}
              holdings={data.holdings ?? []}
              summary={data.summary}
              market={market}
            />

          </div>
        )}

        {activeTab === "ai-decisions" && <AIDecisionsPage data={data} market={market} />}

        {activeTab === "trading" && <TradingHistoryPage history={data.trading_history ?? []} summary={data.summary} prismPerformance={data.prism_performance ?? []} marketCondition={data.market_condition ?? []} market={market} />}

        {activeTab === "watchlist" && <WatchlistPage watchlist={data.watchlist ?? []} market={market} />}

        {activeTab === "insights" && <TradingInsightsPage data={data.trading_insights ?? {}} market={market} />}

        {activeTab === "portfolio" && <PortfolioPage />}

        {activeTab === "news" && <NewsPage />}

        {activeTab === "jeoningu-lab" && <ReportsPage />}

        {activeTab === "agents" && <AgentsPage />}

        {activeTab === "execution" && <ExecutionPage />}

        {activeTab === "settings" && <SettingsPage />}

        {activeTab === "costs" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">{language === "ko" ? "프로젝트 운영 비용" : "Operating Costs"}</span>
            </div>
            <OperatingCostsCard costs={data?.operating_costs ?? {}} />
          </div>
        )}
      </main>

      {/* 프로젝트 소개 Footer */}
      <ProjectFooter />

      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          isRealTrading={isRealTrading}
          market={market}
        />
      )}
    </div>
  )
}

// 메인 페이지 컴포넌트 - Suspense 경계로 래핑
export default function Page() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardContent />
    </Suspense>
  )
}