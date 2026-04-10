"use client"

import {
  LayoutDashboard, Brain, History, Eye,
  TrendingUp, Lightbulb, Newspaper, FileBarChart,
  ShieldCheck, Wallet, Bot, Play, Settings,
  BarChart3, DollarSign,
} from "lucide-react"
import { MarketTickerBar } from "@/components/market-ticker-bar"
import { useLanguage } from "@/components/language-provider"
import type { Market } from "@/types/dashboard"

type TabType = "dashboard" | "ai-decisions" | "trading" | "watchlist" | "insights" | "gainers" | "portfolio" | "news" | "jeoningu-lab" | "agents" | "execution" | "settings" | "costs"

interface DashboardHeaderProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  lastUpdated?: string
  market?: Market
  onMarketChange?: (market: Market) => void
}

// ──────────────────────────────────────────────────────────────
// 메뉴 구조 정의
// ──────────────────────────────────────────────────────────────
const MAIN_MENUS = [
  {
    id: "dashboard-group",
    labelKo: "종합",
    labelEn: "Dashboard",
    icon: LayoutDashboard,
    activeColor: "from-blue-600 to-indigo-600",
    borderColor: "border-blue-500",
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    tabs: ["dashboard", "ai-decisions", "trading", "watchlist"] as TabType[],
  },
  {
    id: "analysis",
    labelKo: "시황",
    labelEn: "Analysis",
    icon: TrendingUp,
    activeColor: "from-emerald-600 to-teal-600",
    borderColor: "border-emerald-500",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    tabs: ["insights", "gainers", "news", "jeoningu-lab"] as TabType[],
  },
  {
    id: "admin",
    labelKo: "관리",
    labelEn: "Admin",
    icon: ShieldCheck,
    activeColor: "from-violet-600 to-purple-600",
    borderColor: "border-violet-500",
    textColor: "text-violet-400",
    bgColor: "bg-violet-500/10",
    tabs: ["portfolio", "agents", "execution", "costs"] as TabType[],
  },
  {
    id: "settings",
    labelKo: "설정",
    labelEn: "Settings",
    icon: Settings,
    activeColor: "from-slate-600 to-gray-600",
    borderColor: "border-slate-500",
    textColor: "text-slate-400",
    bgColor: "bg-slate-500/10",
    tabs: ["settings"] as TabType[],
    direct: true,  // 하위 메뉴 없이 바로 이동
  },
] as const

type MainMenuId = (typeof MAIN_MENUS)[number]["id"]

const SUBMENUS: Record<string, { tab: TabType; labelKo: string; labelEn: string; icon: React.ElementType }[]> = {
  "dashboard-group": [
    { tab: "dashboard",    labelKo: "Summary",      labelEn: "Summary",           icon: BarChart3 },
    { tab: "ai-decisions", labelKo: "AI 보유 분석", labelEn: "AI Analysis",    icon: Brain },
    { tab: "trading",      labelKo: "거래 내역",   labelEn: "Trade History",  icon: History },
    { tab: "watchlist",    labelKo: "관심 종목",   labelEn: "Watchlist",      icon: Eye },
  ],
  "analysis": [
    { tab: "insights",     labelKo: "매매 인사이트",    labelEn: "Trading Insights", icon: Lightbulb },
    { tab: "gainers",      labelKo: "급등주",           labelEn: "Top Gainers",      icon: TrendingUp },
    { tab: "news",         labelKo: "실시간 뉴스키워드", labelEn: "Live News",        icon: Newspaper },
    { tab: "jeoningu-lab", labelKo: "리포트",          labelEn: "Reports",          icon: FileBarChart },
  ],
  "admin": [
    { tab: "portfolio",  labelKo: "포트폴리오 관리",   labelEn: "Portfolio",       icon: Wallet },
    { tab: "agents",     labelKo: "AI 에이전트 현황",  labelEn: "AI Agents",       icon: Bot },
    { tab: "execution",  labelKo: "스크립트",          labelEn: "Scripts",         icon: Play },
    { tab: "costs",      labelKo: "비용 현황",         labelEn: "Costs",           icon: DollarSign },
  ],
}

function getActiveMainMenu(tab: TabType): MainMenuId {
  for (const m of MAIN_MENUS) {
    if (m.tabs.includes(tab as any)) return m.id as MainMenuId
  }
  return "dashboard-group"
}

// ──────────────────────────────────────────────────────────────

export function DashboardHeader({ activeTab, onTabChange, lastUpdated, market = "KR", onMarketChange }: DashboardHeaderProps) {
  const { language, t } = useLanguage()

  const activeMainMenuId = getActiveMainMenu(activeTab)
  const activeMainMenu = MAIN_MENUS.find(m => m.id === activeMainMenuId)!
  const submenus = SUBMENUS[activeMainMenuId] ?? []

  const handleMainMenuClick = (menu: typeof MAIN_MENUS[number]) => {
    if (menu.direct) {
      onTabChange("settings")
    } else {
      // 해당 메뉴의 첫 번째 서브메뉴로 이동
      const first = SUBMENUS[menu.id]?.[0]
      if (first) onTabChange(first.tab)
    }
  }

  const formatLastUpdated = () => {
    if (!lastUpdated) return t("header.realtimeUpdate")
    try {
      const date = new Date(lastUpdated)
      if (!isNaN(date.getTime())) {
        return date.toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
          month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        })
      }
    } catch {}
    return lastUpdated
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 실시간 시장 지수 티커 바 */}
      <MarketTickerBar />

      <div className="container mx-auto px-4 max-w-[1600px]">
        {/* ── Row 1: Logo + Market Selector + Utilities ── */}
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30">
              <svg width="20" height="20" viewBox="0 0 128 128" className="shrink-0">
                <polygon points="64,18 100,52 64,108 28,52" fill="none" stroke="url(#hG)" strokeWidth="5" strokeLinejoin="round"/>
                <polyline points="30,65 52,50 64,42 76,55 98,65" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                  <animate attributeName="strokeWidth" values="5;7;5" dur="1.2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="1.2s" repeatCount="indefinite"/>
                </polyline>
                <defs>
                  <linearGradient id="hG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#f59e0b"}}/>
                    <stop offset="100%" style={{stopColor:"#ef4444"}}/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent leading-none">
                Mimmy
              </h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                {formatLastUpdated()}
              </p>
            </div>
          </div>

          {/* Daily / Night Selector */}
          {onMarketChange && (
            <div className="flex items-center">
              <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => onMarketChange("KR")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-xs transition-all duration-200 ${
                    market === "KR"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>☀️</span>
                  <span>Daily</span>
                </button>
                <button
                  disabled
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium text-xs text-muted-foreground/30 cursor-not-allowed"
                >
                  <span>🌙</span>
                  <span>Night</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── Row 2: 메인 메뉴 (4개) ── */}
        <div className="flex items-end gap-0 border-t border-border/20 pt-1">
          {MAIN_MENUS.map((menu) => {
            const isActive = menu.id === activeMainMenuId
            const Icon = menu.icon
            return (
              <button
                key={menu.id}
                onClick={() => handleMainMenuClick(menu)}
                className={`
                  relative flex items-center gap-2 px-5 py-2.5 font-semibold text-sm
                  transition-all duration-200 rounded-t-lg border border-transparent
                  ${isActive
                    ? `${menu.bgColor} ${menu.textColor} border-border/30 border-b-transparent`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{language === "ko" ? menu.labelKo : menu.labelEn}</span>
                {/* 활성 하단 강조선 */}
                {isActive && (
                  <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${menu.activeColor} rounded-full`} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Row 3: 서브 메뉴 ── */}
        {submenus.length > 0 && (
          <div className={`flex items-center gap-1 py-1.5 border-t ${activeMainMenu.borderColor}/20 overflow-x-auto`}>
            {submenus.map((sub) => {
              const isActive = activeTab === sub.tab
              const SubIcon = sub.icon
              return (
                <button
                  key={sub.tab}
                  onClick={() => onTabChange(sub.tab)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                    whitespace-nowrap transition-all duration-150
                    ${isActive
                      ? `${activeMainMenu.bgColor} ${activeMainMenu.textColor}`
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }
                  `}
                >
                  <SubIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{language === "ko" ? sub.labelKo : sub.labelEn}</span>
                  {isActive && (
                    <span className={`ml-0.5 w-1 h-1 rounded-full ${activeMainMenu.textColor.replace("text-", "bg-")} opacity-80`} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </header>
  )
}
