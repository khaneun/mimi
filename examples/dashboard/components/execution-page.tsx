"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"
import { Play, CheckCircle, XCircle, Loader2 } from "lucide-react"

// --- 파이프라인 스크립트 정의 ---

interface PipelineScript {
  id: string
  nameKo: string
  nameEn: string
  descKo: string
  descEn: string
  script: string
  category: "daily" | "analysis" | "data" | "server"
  color: string
}

const PIPELINE_SCRIPTS: PipelineScript[] = [
  {
    id: "daily",
    nameKo: "일일 통합 파이프라인",
    nameEn: "Daily Pipeline",
    descKo: "거시경제 + 종목 분석 + 아카이브 전체 실행 (평일 21:00 자동)",
    descEn: "Full daily run: macro + stock analysis + archive",
    script: "pipeline/daily_pipeline.py",
    category: "daily",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  },
  {
    id: "macro",
    nameKo: "거시경제 분석",
    nameEn: "Macro Analysis",
    descKo: "Investment Alpha 6인 — 거시/원자재/주식/부동산/종합/월별",
    descEn: "Investment Alpha team — macro/commodity/stock/real estate",
    script: "pipeline/macro_pipeline.py",
    category: "analysis",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  {
    id: "stock",
    nameKo: "종목 분석",
    nameEn: "Stock Analysis",
    descKo: "MarketPulse 에이전트 — 기술/수급/재무/뉴스/시장 분석",
    descEn: "MarketPulse agents — technical/flow/financial/news/market",
    script: "pipeline/stock_pipeline.py",
    category: "analysis",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "news_crawler",
    nameKo: "뉴스 크롤링",
    nameEn: "News Crawler",
    descKo: "RSS 7개 매체 + YouTube 5채널 수집 및 키워드 분석",
    descEn: "RSS 7 sources + YouTube 5 channels + keyword analysis",
    script: "pipeline/news_crawler.py",
    category: "data",
    color: "bg-red-500/10 text-red-400 border-red-500/30",
  },
  {
    id: "news_analyzer",
    nameKo: "뉴스 분석",
    nameEn: "News Analyzer",
    descKo: "수집된 뉴스 감정/섹터 분석 및 대시보드 JSON 갱신",
    descEn: "Sentiment/sector analysis and dashboard JSON update",
    script: "pipeline/news_analyzer.py",
    category: "data",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  {
    id: "watchlist",
    nameKo: "관심종목 분석",
    nameEn: "Watchlist Analysis",
    descKo: "보유 + 관심 종목 모니터링 및 신호 감지",
    descEn: "Holdings + watchlist monitoring and signal detection",
    script: "pipeline/watchlist_analyzer.py",
    category: "analysis",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  {
    id: "archive",
    nameKo: "리포트 아카이브",
    nameEn: "Archive Pipeline",
    descKo: "생성된 리포트 날짜별 아카이브 정리",
    descEn: "Archive generated reports by date",
    script: "pipeline/archive_pipeline.py",
    category: "data",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "realtime",
    nameKo: "실시간 서버",
    nameEn: "Realtime Server",
    descKo: "1분 주기 시세 + 5분 주기 뉴스 갱신 서버 (상시 실행)",
    descEn: "1-min price refresh + 5-min news update server",
    script: "pipeline/realtime_server.py",
    category: "server",
    color: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  },
]

const CATEGORY_LABEL: Record<string, { ko: string; en: string }> = {
  daily:    { ko: "통합", en: "Daily" },
  analysis: { ko: "분석", en: "Analysis" },
  data:     { ko: "데이터", en: "Data" },
  server:   { ko: "서버", en: "Server" },
}

// --- Types ---

interface RunState {
  status: "idle" | "running" | "done" | "error"
  message?: string
  startedAt?: number
}

// --- Component ---

export function ExecutionPage() {
  const { language } = useLanguage()
  const [runStates, setRunStates] = useState<Record<string, RunState>>({})
  const [elapsed, setElapsed] = useState<Record<string, number>>({})

  // 실행 중인 항목의 경과 시간 갱신
  useEffect(() => {
    const ticker = setInterval(() => {
      const now = Date.now()
      const newElapsed: Record<string, number> = {}
      for (const [id, state] of Object.entries(runStates)) {
        if (state.status === "running" && state.startedAt) {
          newElapsed[id] = Math.floor((now - state.startedAt) / 1000)
        }
      }
      if (Object.keys(newElapsed).length > 0) {
        setElapsed(prev => ({ ...prev, ...newElapsed }))
      }
    }, 1000)
    return () => clearInterval(ticker)
  }, [runStates])

  const runScript = async (script: PipelineScript) => {
    setRunStates(prev => ({
      ...prev,
      [script.id]: { status: "running", startedAt: Date.now() },
    }))
    setElapsed(prev => ({ ...prev, [script.id]: 0 }))

    try {
      const res = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.script }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRunStates(prev => ({
          ...prev,
          [script.id]: { status: "done", message: data.message ?? "실행 완료" },
        }))
      } else {
        setRunStates(prev => ({
          ...prev,
          [script.id]: { status: "error", message: data.error ?? `HTTP ${res.status}` },
        }))
      }
    } catch (e: any) {
      setRunStates(prev => ({
        ...prev,
        [script.id]: { status: "error", message: e.message },
      }))
    }
  }

  const categories = ["daily", "analysis", "data", "server"] as const

  return (
    <div className="space-y-6">
      {/* Script groups */}
      {categories.map(cat => {
        const scripts = PIPELINE_SCRIPTS.filter(s => s.category === cat)
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {language === "ko" ? CATEGORY_LABEL[cat].ko : CATEGORY_LABEL[cat].en}
              </span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {scripts.map(script => {
                const state = runStates[script.id] ?? { status: "idle" }
                const isRunning = state.status === "running"
                return (
                  <Card key={script.id} className={`border-border/50 bg-card/50 ${isRunning ? "border-blue-500/40" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-[10px] ${script.color}`}>
                              {language === "ko" ? CATEGORY_LABEL[script.category].ko : CATEGORY_LABEL[script.category].en}
                            </Badge>
                            {state.status === "running" && (
                              <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                                {elapsed[script.id] ?? 0}s
                              </Badge>
                            )}
                            {state.status === "done" && (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            {state.status === "error" && (
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {language === "ko" ? script.nameKo : script.nameEn}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {language === "ko" ? script.descKo : script.descEn}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">{script.script}</p>
                          {state.status === "error" && state.message && (
                            <p className="text-xs text-red-400 mt-1 truncate">{state.message}</p>
                          )}
                          {state.status === "done" && state.message && (
                            <p className="text-xs text-emerald-400 mt-1">{state.message}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={isRunning ? "secondary" : "outline"}
                          disabled={isRunning}
                          onClick={() => runScript(script)}
                          className="shrink-0 h-8 px-3"
                        >
                          {isRunning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span className="ml-1.5 text-xs">
                            {isRunning
                              ? (language === "ko" ? "실행 중" : "Running")
                              : (language === "ko" ? "실행" : "Run")}
                          </span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
