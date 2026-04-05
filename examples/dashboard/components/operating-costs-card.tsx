"use client"

import { useState, useEffect } from "react"
import { Server, Heart, Cpu, Zap, Clock, Brain } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/components/language-provider"

interface OperatingCostsCardProps {
  costs?: {
    server_hosting: number
    openai_api: number
    anthropic_api: number
    firecrawl_api: number
    perplexity_api: number
    month: string
  }
}

export function OperatingCostsCard({ costs }: OperatingCostsCardProps) {
  const { language, t } = useLanguage()

  const actualMonth = costs?.month || "2026-04"

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return ''
    const [year, month] = monthStr.split('-')
    if (language === "en") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      return `${monthNames[parseInt(month) - 1]} ${year}`
    }
    return `${year}${t("date.year")} ${parseInt(month)}${t("date.month")}`
  }

  const services = [
    {
      name: "Claude Code (Max)",
      desc: language === "ko" ? "AI 분석 엔진 · 뉴스 · 종목분석" : "AI Analysis Engine",
      icon: Cpu,
      color: "text-orange-400",
      gradient: "from-orange-500/20 to-amber-500/5",
      status: language === "ko" ? "구독 포함" : "Included",
      statusColor: "text-green-400",
      cost: "$0",
    },
    {
      name: language === "ko" ? "로컬 서버 (Mac)" : "Local Server (Mac)",
      desc: language === "ko" ? "대시보드 · 실시간 서버" : "Dashboard · Realtime Server",
      icon: Server,
      color: "text-blue-400",
      gradient: "from-blue-500/20 to-blue-500/5",
      status: language === "ko" ? "무료" : "Free",
      statusColor: "text-green-400",
      cost: "$0",
    },
    {
      name: language === "ko" ? "한국투자증권 API" : "KIS API",
      desc: language === "ko" ? "실시간 시세 · 해외 ETF" : "Realtime Prices · ETF",
      icon: Zap,
      color: "text-emerald-400",
      gradient: "from-emerald-500/20 to-emerald-500/5",
      status: language === "ko" ? "연결됨" : "Connected",
      statusColor: "text-green-400",
      cost: "$0",
    },
    {
      name: language === "ko" ? "KRX · pykrx" : "KRX Data",
      desc: language === "ko" ? "OHLCV · 투자자별 거래" : "OHLCV · Trading Data",
      icon: Server,
      color: "text-cyan-400",
      gradient: "from-cyan-500/20 to-cyan-500/5",
      status: language === "ko" ? "연결됨" : "Connected",
      statusColor: "text-green-400",
      cost: "$0",
    },
  ]

  return (
    <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-6">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500 animate-pulse" />
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {t("costs.title")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {formatMonth(actualMonth)} {t("costs.basis")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">$0</div>
              <div className="text-[10px] text-muted-foreground">
                {language === "ko" ? "추가 비용 없음" : "No extra cost"}
              </div>
            </div>
          </div>

          {/* Service Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {services.map((svc, i) => {
              const Icon = svc.icon
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-lg border border-border/50 hover:border-border transition-all duration-300 hover:shadow-md"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${svc.gradient} opacity-50`} />
                  <div className="relative p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Icon className={`w-5 h-5 ${svc.color}`} />
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className={`text-[10px] font-medium ${svc.statusColor}`}>{svc.status}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{svc.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{svc.desc}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Claude Code Usage */}
          <ClaudeUsagePanel language={language} />

          {/* Footer */}
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[11px] text-muted-foreground text-center">
              MarketPulse — Claude Code (Max {language === "ko" ? "구독" : "subscription"}) + {language === "ko" ? "한투 실시간 시세 기반 통합 투자 분석" : "KIS Realtime · Integrated AI Investment Analysis"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Claude Code 사용량 패널
function ClaudeUsagePanel({ language }: { language: string }) {
  const [resetTime, setResetTime] = useState("")
  const [resetCountdown, setResetCountdown] = useState("")

  useEffect(() => {
    const updateReset = () => {
      // Max 구독 리셋: 매일 UTC 00:00 (KST 09:00)
      const now = new Date()
      const nextReset = new Date(now)
      nextReset.setUTCHours(24, 0, 0, 0) // 다음 UTC 자정
      if (nextReset <= now) nextReset.setUTCDate(nextReset.getUTCDate() + 1)

      setResetTime(nextReset.toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }))

      const diffMs = nextReset.getTime() - now.getTime()
      const hours = Math.floor(diffMs / 3600000)
      const mins = Math.floor((diffMs % 3600000) / 60000)
      setResetCountdown(language === "ko" ? `${hours}시간 ${mins}분 후` : `in ${hours}h ${mins}m`)
    }

    updateReset()
    const interval = setInterval(updateReset, 60000) // 1분마다 갱신
    return () => clearInterval(interval)
  }, [language])

  const models = [
    { name: "Opus 4.6", color: "bg-purple-500", desc: language === "ko" ? "아키텍처 · 복잡한 분석" : "Architecture" },
    { name: "Sonnet 4.6", color: "bg-blue-500", desc: language === "ko" ? "코딩 · 일반 작업" : "Coding" },
    { name: "Haiku 4.5", color: "bg-cyan-500", desc: language === "ko" ? "서브에이전트 · 빠른 작업" : "Sub-agents" },
  ]

  return (
    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-foreground">Claude Code</span>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
            Max
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{language === "ko" ? "리셋" : "Reset"}: {resetCountdown}</span>
        </div>
      </div>

      {/* 모델별 */}
      <div className="grid grid-cols-3 gap-2">
        {models.map(m => (
          <div key={m.name} className="p-2 rounded-md bg-background/50 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${m.color}`} />
              <span className="text-[11px] font-medium text-foreground">{m.name}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* 리셋 시간 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
        <span className="text-[10px] text-muted-foreground">
          {language === "ko" ? "다음 리셋" : "Next reset"}: {resetTime}
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-400">{language === "ko" ? "구독 활성" : "Active"}</span>
        </div>
      </div>
    </div>
  )
}
