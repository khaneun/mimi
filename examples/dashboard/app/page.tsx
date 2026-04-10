"use client"

import { useState, useEffect, useRef, useCallback, Suspense, ElementType } from "react"
import { Brain, History, Eye, BarChart3, Lightbulb, Newspaper, FileBarChart, Wallet, Bot, Play, DollarSign, Settings as SettingsIcon, RefreshCw, TrendingUp } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { OperatingCostsCard } from "@/components/operating-costs-card"
import { MetricsCards } from "@/components/metrics-cards"
import { HoldingsTable } from "@/components/holdings-table"
import { PerformanceChart, IndexCharts } from "@/components/performance-chart"
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

type TabType = "dashboard" | "ai-decisions" | "trading" | "watchlist" | "insights" | "gainers" | "news" | "jeoningu-lab" | "agents" | "execution" | "settings" | "costs"
const VALID_TABS: TabType[] = ["dashboard", "ai-decisions", "trading", "watchlist", "insights", "gainers", "news", "jeoningu-lab", "agents", "execution", "settings", "costs"]

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
  const [kisPortfolio, setKisPortfolio] = useState<{ summary: any; stocks: any[] } | null>(null)
  const [kisMode, setKisMode] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("kis_mode") || "paper"
    return "paper"
  })
  const [kisLoading, setKisLoading] = useState<boolean>(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [summaryTab, setSummaryTab] = useState<"general" | "ai">("general")

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

  const fetchData = useCallback(async () => {
    try {
      setDataError(null)
      const dataFile = getDataFilePath(market, language)
      const response = await fetch(`${dataFile}?t=${Date.now()}`)

      if (!response.ok) {
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
  }, [language, market])

  const handlePageRefresh = useCallback(() => {
    fetchData()
    setRefreshKey(k => k + 1)
  }, [fetchData])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // KIS 포트폴리오 데이터 로드 (GET — portfolio_data.json 읽기)
  const applyPortfolioData = (d: any) => {
    const account = d?.accounts?.[0]
    if (account) {
      setKisPortfolio({ summary: account.summary ?? {}, stocks: account.stocks ?? [] })
    }
    if (d?.kis_mode) setKisMode(d.kis_mode)
  }

  // 초기: settings → 모드 확정 → portfolio POST(sync)
  useEffect(() => {
    if (market !== "KR") return
    ;(async () => {
      // 1) 서버 설정으로 모드 확정 (없으면 localStorage 값 유지)
      let mode = (typeof window !== "undefined" ? localStorage.getItem("kis_mode") : null) || "paper"
      try {
        const s = await fetch("/api/settings").then(r => r.json())
        if (s?.kis_mode) {
          mode = s.kis_mode
          setKisMode(mode)
          if (typeof window !== "undefined") localStorage.setItem("kis_mode", mode)
        }
      } catch {}
      // 2) 확정된 모드로 KIS sync
      setKisLoading(true)
      try {
        const res = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        })
        const d = await res.json()
        if (d.success && d.data) {
          applyPortfolioData(d.data)
        } else {
          await fetch("/api/portfolio?" + Date.now()).then(r => r.json()).then(applyPortfolioData).catch(() => {})
        }
      } catch {
        await fetch("/api/portfolio?" + Date.now()).then(r => r.json()).then(applyPortfolioData).catch(() => {})
      } finally {
        setKisLoading(false)
      }
    })()
  }, [market])

  // 투자 모드 변경 시: ① 모드 태그 즉시 반영 → ② 새 계좌로 KIS 재동기화
  useEffect(() => {
    const handler = async (e: Event) => {
      const newMode = (e as CustomEvent).detail.mode as string
      setKisMode(newMode)   // ① 즉시 반영
      if (typeof window !== "undefined") localStorage.setItem("kis_mode", newMode)  // ② localStorage 영속
      setKisLoading(true)   // ③ 로딩 시작 (기존 데이터 유지)
      try {
        const res = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: newMode }),
        })
        const data = await res.json()
        if (data.success && data.data) {
          applyPortfolioData(data.data)
        } else {
          await fetch("/api/portfolio?" + Date.now()).then(r => r.json()).then(applyPortfolioData).catch(() => {})
        }
      } catch {
        await fetch("/api/portfolio?" + Date.now()).then(r => r.json()).then(applyPortfolioData).catch(() => {})
      } finally {
        setKisLoading(false) // ③ 로딩 완료
      }
    }
    window.addEventListener("kis-mode-changed", handler)
    return () => window.removeEventListener("kis-mode-changed", handler)
  }, [])

  // 하위 메뉴 페이지 헤더 데이터
  const PAGE_HEADERS: Record<string, { icon: ElementType; labelKo: string; labelEn: string; descKo: string; descEn: string }> = {
    "dashboard":    { icon: BarChart3,    labelKo: "Summary",         labelEn: "Summary",           descKo: "보유 종목 현황 및 투자 요약",           descEn: "Holdings status and investment summary" },
    "ai-decisions": { icon: Brain,        labelKo: "AI 보유 분석",    labelEn: "AI Analysis",       descKo: "AI 분석 기반 보유 종목 판단 내역",       descEn: "AI-based holding decisions" },
    "trading":      { icon: History,      labelKo: "거래 내역",       labelEn: "Trade History",     descKo: "매매 완료 내역 및 수익 분석",            descEn: "Completed trades and performance" },
    "watchlist":    { icon: Eye,          labelKo: "관심 종목",       labelEn: "Watchlist",         descKo: "관심 종목 모니터링",                    descEn: "Monitor and track watchlist stocks" },
    "insights":     { icon: Lightbulb,    labelKo: "매매 인사이트",   labelEn: "Trading Insights",  descKo: "매매 패턴 및 트리거 신뢰도 분석",        descEn: "Trading patterns and trigger analysis" },
    "news":         { icon: Newspaper,    labelKo: "실시간 뉴스키워드", labelEn: "Live News",        descKo: "실시간 뉴스 키워드 트렌드",              descEn: "Real-time news keyword trends" },
    "jeoningu-lab": { icon: FileBarChart, labelKo: "리포트",          labelEn: "Reports",           descKo: "AI 분석 리포트 아카이브",               descEn: "AI analysis reports archive" },
    "agents":       { icon: Bot,          labelKo: "AI 에이전트 현황", labelEn: "AI Agents",        descKo: "AI 에이전트 팀 현황 및 프롬프트",        descEn: "AI agent team and prompts" },
    "execution":    { icon: Play,         labelKo: "스크립트",       labelEn: "Scripts",           descKo: "분석 파이프라인 실행 및 모니터링",        descEn: "Run and monitor analysis pipeline" },
    "costs":        { icon: DollarSign,   labelKo: "비용 현황",       labelEn: "Costs",             descKo: "프로젝트 운영 비용",                    descEn: "Project operating costs" },
    "settings":     { icon: SettingsIcon, labelKo: "설정",            labelEn: "Settings",          descKo: "투자 모드 및 시스템 설정",              descEn: "Investment mode and system settings" },
    "gainers":      { icon: TrendingUp,  labelKo: "일반",             labelEn: "General",           descKo: "시장 지수 및 당일 급등주",               descEn: "Market index & top gainers today" },
  }

  const PageHeaderBlock = ({ tabId, onRefresh }: { tabId: string; onRefresh?: () => void }) => {
    const hdr = PAGE_HEADERS[tabId]
    if (!hdr) return null
    return (
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground/70">
          {language === "ko" ? hdr.descKo : hdr.descEn}
        </p>
        {onRefresh && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} title={language === "ko" ? "새로고침" : "Refresh"}>
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    )
  }

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
          <div className="space-y-4">
            {/* 헤더: 설명 + General/AI 탭 + 새로고침 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground/70">
                {language === "ko" ? PAGE_HEADERS["dashboard"].descKo : PAGE_HEADERS["dashboard"].descEn}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setSummaryTab("general")}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all duration-200 ${
                      summaryTab === "general"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setSummaryTab("ai")}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all duration-200 ${
                      summaryTab === "ai"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    AI
                  </button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePageRefresh} title={language === "ko" ? "새로고침" : "Refresh"}>
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* General 탭: 포트폴리오 현황 */}
            {summaryTab === "general" && (
              <PortfolioPage key={refreshKey} />
            )}

            {/* AI 탭: AI Simulator + 시뮬레이션 + 수익률 비교 차트 */}
            {summaryTab === "ai" && (
              <div className="space-y-6">
                <MetricsCards
                  summary={data.summary}
                  kisPortfolio={kisPortfolio}
                  kisMode={kisMode}
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
                  kisLoading={kisLoading}
                  showRealTrading={false}
                />
                <HoldingsTable
                  holdings={data.holdings ?? []}
                  onStockClick={(stock) => handleStockClick(stock, false)}
                  title={t("table.simulator")}
                  isRealTrading={false}
                  market={market}
                />
                {data.trading_insights?.trigger_reliability && (
                  <TriggerReliabilityBadge
                    data={data.trading_insights.trigger_reliability}
                    onNavigateToInsights={() => handleTabChange("insights")}
                  />
                )}
                <PerformanceChart
                  data={data.market_condition ?? []}
                  prismPerformance={data.prism_performance ?? []}
                  holdings={data.holdings ?? []}
                  summary={data.summary}
                  market={market}
                  showIndex={false}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "ai-decisions" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="ai-decisions" onRefresh={handlePageRefresh} />
            <AIDecisionsPage data={data} market={market} />
          </div>
        )}

        {activeTab === "trading" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="trading" onRefresh={handlePageRefresh} />
            <TradingHistoryPage history={data.trading_history ?? []} summary={data.summary} prismPerformance={data.prism_performance ?? []} marketCondition={data.market_condition ?? []} market={market} />
          </div>
        )}

        {activeTab === "watchlist" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="watchlist" onRefresh={handlePageRefresh} />
            <WatchlistPage watchlist={data.watchlist ?? []} market={market} />
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="insights" onRefresh={handlePageRefresh} />
            <TradingInsightsPage data={data.trading_insights ?? {}} market={market} />
          </div>
        )}

        {activeTab === "gainers" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="gainers" onRefresh={handlePageRefresh} />
            {/* KOSPI/KOSDAQ 지수 차트 */}
            <IndexCharts data={data.market_condition ?? []} market={market} />
            {data.top_gainers && data.top_gainers.length > 0 ? (
              <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-2xl">🔥</span>
                  <h3 className="text-xl font-bold text-foreground">급등주 TOP 5</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{data.realtime?.updated_at}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {data.top_gainers.map((g: any, i: number) => (
                    <div key={g.code ?? i} className="text-center p-5 rounded-xl bg-card/60 border border-border/30 hover:border-red-500/40 transition-colors">
                      <p className="text-xs text-muted-foreground truncate mb-2">{g.name}</p>
                      <p className="text-xl font-bold text-foreground">{(g.price ?? 0).toLocaleString()}</p>
                      <p className="text-lg font-bold text-red-400 mt-1">▲{g.change_rate}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg">급등주 데이터가 없습니다.</p>
                <p className="text-sm mt-1 text-muted-foreground/60">장 중에 데이터가 업데이트됩니다.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "news" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="news" onRefresh={handlePageRefresh} />
            <NewsPage key={refreshKey} />
          </div>
        )}

        {activeTab === "jeoningu-lab" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="jeoningu-lab" onRefresh={handlePageRefresh} />
            <ReportsPage key={refreshKey} />
          </div>
        )}

        {activeTab === "agents" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="agents" onRefresh={handlePageRefresh} />
            <AgentsPage key={refreshKey} />
          </div>
        )}

        {activeTab === "execution" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="execution" onRefresh={handlePageRefresh} />
            <ExecutionPage />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="settings" onRefresh={handlePageRefresh} />
            <SettingsPage key={refreshKey} />
          </div>
        )}

        {activeTab === "costs" && (
          <div className="space-y-4">
            <PageHeaderBlock tabId="costs" onRefresh={handlePageRefresh} />
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