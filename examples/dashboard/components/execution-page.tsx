"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/components/language-provider"
import { Play, CheckCircle, XCircle, Loader2, FileText, RefreshCw, Square } from "lucide-react"

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
  lastRunAt?: string  // "yyyy-mm-dd hh:mm:ss"
}

interface LogDialog {
  open: boolean
  id: string
  name: string
  content: string
  loading: boolean
  stopping: boolean
}

// --- Component ---

export function ExecutionPage() {
  const { language } = useLanguage()
  const [runStates, setRunStates] = useState<Record<string, RunState>>({})
  const [elapsed, setElapsed] = useState<Record<string, number>>({})
  const [logDialog, setLogDialog] = useState<LogDialog>({
    open: false, id: "", name: "", content: "", loading: false, stopping: false,
  })

  // API에서 프로세스 상태 + 마지막 실행 시간 동기화
  const syncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/execution")
      if (!res.ok) return
      const data = await res.json() as {
        lastRunTimes: Record<string, string>
        running: string[]
      }

      setRunStates(prev => {
        const next = { ...prev }

        // 서버 저장된 마지막 실행 시간 반영 (아직 UI에 없는 경우)
        for (const [id, time] of Object.entries(data.lastRunTimes)) {
          const cur = next[id] ?? { status: "idle" as const }
          if (!cur.lastRunAt) {
            next[id] = { ...cur, lastRunAt: time }
          }
        }

        // 프로세스 실행 여부 반영
        for (const script of PIPELINE_SCRIPTS) {
          const cur = next[script.id] ?? { status: "idle" as const }
          const serverRunning = data.running.includes(script.id)

          if (serverRunning && cur.status !== "running") {
            // 서버에서 실행 중이지만 UI는 모르는 경우 (예: 페이지 재진입)
            next[script.id] = { ...cur, status: "running", startedAt: Date.now() }
          } else if (!serverRunning && cur.status === "running") {
            // 실행 중이었는데 프로세스가 종료된 경우 → done으로 전환
            next[script.id] = {
              status: "done",
              lastRunAt: data.lastRunTimes[script.id] ?? cur.lastRunAt,
            }
          }
        }

        return next
      })
    } catch {
      // 네트워크 오류 무시
    }
  }, [])

  // 마운트 시 초기 상태 로드
  useEffect(() => {
    syncStatus()
  }, [syncStatus])

  // running 상태인 스크립트가 있는 동안 5초마다 폴링
  useEffect(() => {
    const hasRunning = Object.values(runStates).some(s => s.status === "running")
    if (!hasRunning) return
    const interval = setInterval(syncStatus, 5000)
    return () => clearInterval(interval)
  }, [runStates, syncStatus])

  // 실행 중인 항목의 경과 시간 갱신 (1초 단위)
  useEffect(() => {
    const ticker = setInterval(() => {
      const now = Date.now()
      const updates: Record<string, number> = {}
      for (const [id, state] of Object.entries(runStates)) {
        if (state.status === "running" && state.startedAt) {
          updates[id] = Math.floor((now - state.startedAt) / 1000)
        }
      }
      if (Object.keys(updates).length > 0) {
        setElapsed(prev => ({ ...prev, ...updates }))
      }
    }, 1000)
    return () => clearInterval(ticker)
  }, [runStates])

  const runScript = async (script: PipelineScript) => {
    // 즉시 running 상태로 전환 (버튼 비활성화)
    setRunStates(prev => ({
      ...prev,
      [script.id]: { ...prev[script.id], status: "running", startedAt: Date.now() },
    }))
    setElapsed(prev => ({ ...prev, [script.id]: 0 }))

    try {
      const res = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.script }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        // 실행 실패 시에만 error 상태로 전환
        setRunStates(prev => ({
          ...prev,
          [script.id]: {
            ...prev[script.id],
            status: "error",
            message: data.error ?? `HTTP ${res.status}`,
            lastRunAt: new Date().toISOString().replace("T", " ").substring(0, 19),
          },
        }))
        return
      }
      // 성공: running 유지, 폴링이 완료 시점 감지
    } catch (e: any) {
      setRunStates(prev => ({
        ...prev,
        [script.id]: {
          ...prev[script.id],
          status: "error",
          message: e.message,
          lastRunAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        },
      }))
    }
  }

  const openLog = async (script: PipelineScript) => {
    setLogDialog({
      open: true,
      id: script.id,
      name: language === "ko" ? script.nameKo : script.nameEn,
      content: "",
      loading: true,
      stopping: false,
    })
    try {
      const res = await fetch(`/api/execution?log=${script.id}`)
      const data = await res.json()
      setLogDialog(prev => ({
        ...prev,
        content: data.log || "(로그 없음)",
        loading: false,
      }))
    } catch {
      setLogDialog(prev => ({ ...prev, content: "(로그 조회 실패)", loading: false }))
    }
  }

  const refreshLog = async () => {
    setLogDialog(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch(`/api/execution?log=${logDialog.id}`)
      const data = await res.json()
      setLogDialog(prev => ({
        ...prev,
        content: data.log || "(로그 없음)",
        loading: false,
      }))
    } catch {
      setLogDialog(prev => ({ ...prev, content: "(로그 조회 실패)", loading: false }))
    }
  }

  const stopScript = async () => {
    setLogDialog(prev => ({ ...prev, stopping: true }))
    try {
      await fetch(`/api/execution?id=${logDialog.id}`, { method: "DELETE" })
      // 중단 후 상태 폴링에서 감지되도록 즉시 syncStatus 호출
      await syncStatus()
    } finally {
      setLogDialog(prev => ({ ...prev, stopping: false }))
    }
  }

  const categories = ["daily", "analysis", "data", "server"] as const

  return (
    <div className="space-y-6">
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
                  <Card
                    key={script.id}
                    className={`border-border/50 bg-card/50 ${isRunning ? "border-blue-500/40" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        {/* 왼쪽: 스크립트 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-[10px] ${script.color}`}>
                              {language === "ko" ? CATEGORY_LABEL[script.category].ko : CATEGORY_LABEL[script.category].en}
                            </Badge>
                            {isRunning && (
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
                          <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">
                            {script.script}
                          </p>
                          {state.status === "error" && state.message && (
                            <p className="text-xs text-red-400 mt-1 truncate">{state.message}</p>
                          )}
                          {state.lastRunAt && (
                            <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                              {language === "ko" ? "마지막 실행" : "Last run"}: {state.lastRunAt}
                            </p>
                          )}
                        </div>

                        {/* 오른쪽: 실행 버튼 + 로그 버튼 */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant={isRunning ? "secondary" : "outline"}
                            disabled={isRunning}
                            onClick={() => runScript(script)}
                            className="h-8 px-3"
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
                          {/* 로그 버튼 */}
                          <button
                            onClick={() => openLog(script)}
                            className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>{language === "ko" ? "로그" : "Log"}</span>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* 로그 다이얼로그 */}
      <Dialog
        open={logDialog.open}
        onOpenChange={open => setLogDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm font-semibold">
                {logDialog.name} — {language === "ko" ? "실행 로그" : "Execution Log"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {/* 새로고침 버튼 */}
                <button
                  onClick={refreshLog}
                  disabled={logDialog.loading}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${logDialog.loading ? "animate-spin" : ""}`} />
                  <span>{language === "ko" ? "새로고침" : "Refresh"}</span>
                </button>
                {/* 중단 버튼 — 실행 중일 때만 활성 */}
                <button
                  onClick={stopScript}
                  disabled={logDialog.stopping || !runStates[logDialog.id] || runStates[logDialog.id].status !== "running"}
                  className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {logDialog.stopping ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Square className="w-3 h-3 fill-current" />
                  )}
                  <span>{language === "ko" ? "중단" : "Stop"}</span>
                </button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[55vh] rounded border border-border/30 bg-black/30">
            {logDialog.loading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="p-4 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                {logDialog.content}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
