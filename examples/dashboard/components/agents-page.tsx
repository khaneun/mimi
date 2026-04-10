"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Landmark, CandlestickChart, Code2, CheckCircle, XCircle, FileText, Loader2 } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

type AgentGroup = "Investment Alpha" | "MarketPulse" | "Dev Team"

interface Agent {
  id: string
  name: string
  roleKo: string
  roleEn: string
  group: AgentGroup
  promptPath: string
  status: "active" | "inactive"
}

const AGENTS: Agent[] = [
  // Investment Alpha
  { id: "macro-economist",    name: "macro-economist",    roleKo: "거시경제 분석가 — Fed 금리, 인플레이션, GDP, 환율 분석",         roleEn: "Macro Economist — Fed rates, inflation, GDP, FX",              group: "Investment Alpha", promptPath: ".claude/agents/macro-economist.md",    status: "active" },
  { id: "commodity-analyst",  name: "commodity-analyst",  roleKo: "원자재 분석가 — 금/은/원유, 중앙은행 매입, 산업 수요",           roleEn: "Commodity Analyst — Gold/Silver/Oil, central bank, demand",   group: "Investment Alpha", promptPath: ".claude/agents/commodity-analyst.md",  status: "active" },
  { id: "stock-analyst",      name: "stock-analyst",      roleKo: "주식 분석가 — S&P500, KOSPI, 섹터 분석, 30종목 추천",           roleEn: "Stock Analyst — S&P500, KOSPI, sectors, top 30 picks",        group: "Investment Alpha", promptPath: ".claude/agents/stock-analyst.md",      status: "active" },
  { id: "real-estate-analyst",name: "real-estate-analyst",roleKo: "부동산 분석가 — 서울/수도권, REITs, 정책 분석",                  roleEn: "Real Estate Analyst — Seoul/metro, REITs, policy",            group: "Investment Alpha", promptPath: ".claude/agents/real-estate-analyst.md",status: "active" },
  { id: "chief-analyst",      name: "chief-analyst",      roleKo: "종합 분석가 — 4명 리포트 종합, 포트폴리오 전략",                 roleEn: "Chief Analyst — Synthesizes 4 reports, portfolio strategy",   group: "Investment Alpha", promptPath: ".claude/agents/chief-analyst.md",      status: "active" },
  { id: "monthly-reporter",   name: "monthly-reporter",   roleKo: "월별 리포터 — 월별 시장 분석 + 매매 성과 리포트",               roleEn: "Monthly Reporter — Monthly market + trading report",           group: "Investment Alpha", promptPath: ".claude/agents/monthly-reporter.md",   status: "active" },
  // MarketPulse
  { id: "technical-analyst",  name: "technical-analyst",  roleKo: "기술 분석가 — OHLCV, MA, RSI, MACD, 볼린저밴드",              roleEn: "Technical Analyst — OHLCV, MA, RSI, MACD, Bollinger",        group: "MarketPulse",      promptPath: "inline (stock_pipeline.py)",           status: "active" },
  { id: "trading-flow-analyst",name:"trading-flow-analyst",roleKo: "수급 분석가 — 기관/외국인/개인 투자자 거래 동향",               roleEn: "Trading Flow Analyst — Institutional/foreign/retail flow",    group: "MarketPulse",      promptPath: "inline",                               status: "active" },
  { id: "financial-analyst",  name: "financial-analyst",  roleKo: "재무 분석가 — EPS, PER, PBR, ROE, 배당",                      roleEn: "Financial Analyst — EPS, PER, PBR, ROE, dividends",          group: "MarketPulse",      promptPath: "inline",                               status: "active" },
  { id: "news-analyst",       name: "news-analyst",       roleKo: "뉴스 분석가 — 뉴스/이벤트 분석, 촉매 요인",                    roleEn: "News Analyst — News/event analysis, catalysts",               group: "MarketPulse",      promptPath: "inline",                               status: "active" },
  { id: "market-analyst",     name: "market-analyst",     roleKo: "시장 분석가 — KOSPI/KOSDAQ 맥락, 종목 포지셔닝",              roleEn: "Market Analyst — KOSPI/KOSDAQ context, positioning",         group: "MarketPulse",      promptPath: "inline",                               status: "active" },
  { id: "investment-strategist",name:"investment-strategist",roleKo:"투자 전략가 — 6명 분석 종합, 최종 투자 의견",               roleEn: "Investment Strategist — Synthesizes 6 analyses",             group: "MarketPulse",      promptPath: "inline",                               status: "active" },
  // Dev Team
  { id: "solution-architect", name: "solution-architect", roleKo: "솔루션 아키텍트 — Harness Pattern 설계, 팀 조율",             roleEn: "Solution Architect — Harness Pattern, team coordination",    group: "Dev Team",         promptPath: ".claude/agents/solution-architect.md", status: "active" },
  { id: "frontend-developer", name: "frontend-developer", roleKo: "프론트엔드 개발자 — Next.js 대시보드 개발",                   roleEn: "Frontend Developer — Next.js dashboard",                      group: "Dev Team",         promptPath: ".claude/agents/frontend-developer.md", status: "active" },
  { id: "qa-engineer",        name: "qa-engineer",        roleKo: "QA 엔지니어 — E2E 테스트, 데이터 검증",                       roleEn: "QA Engineer — E2E testing, data validation",                  group: "Dev Team",         promptPath: ".claude/agents/qa-engineer.md",        status: "active" },
  { id: "devops-engineer",    name: "devops-engineer",    roleKo: "DevOps 엔지니어 — 빌드/배포, 모니터링",                       roleEn: "DevOps Engineer — Build/deploy, monitoring",                  group: "Dev Team",         promptPath: ".claude/agents/devops-engineer.md",    status: "active" },
  { id: "ux-reviewer",        name: "ux-reviewer",        roleKo: "UX 리뷰어 — 사용성/접근성 검증",                              roleEn: "UX Reviewer — Usability/accessibility review",                group: "Dev Team",         promptPath: ".claude/agents/ux-reviewer.md",        status: "active" },
]

const GROUP_META: Record<AgentGroup, {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  badgeClass: string
  bgClass: string
  descKo: string
  descEn: string
}> = {
  "Investment Alpha": {
    icon: Landmark,
    iconColor: "text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    bgClass: "bg-blue-500/10",
    descKo: "거시경제·원자재·주식·부동산 전문 분석팀",
    descEn: "Macro·Commodity·Stock·Real Estate analysts",
  },
  "MarketPulse": {
    icon: CandlestickChart,
    iconColor: "text-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bgClass: "bg-emerald-500/10",
    descKo: "종목 기술·수급·재무·뉴스·시장 분석팀",
    descEn: "Technical·Flow·Financial·News·Market analysts",
  },
  "Dev Team": {
    icon: Code2,
    iconColor: "text-purple-400",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    bgClass: "bg-purple-500/10",
    descKo: "아키텍처·프론트엔드·QA·DevOps·UX 개발팀",
    descEn: "Architecture·Frontend·QA·DevOps·UX team",
  },
}

const GROUPS: AgentGroup[] = ["Investment Alpha", "MarketPulse", "Dev Team"]

export function AgentsPage() {
  const { language } = useLanguage()
  const [openPrompt, setOpenPrompt] = useState<string | null>(null)
  const [promptContents, setPromptContents] = useState<Record<string, string>>({})
  const [promptLoading, setPromptLoading] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const handlePromptClick = async (agent: Agent) => {
    if (openPrompt === agent.id) {
      setOpenPrompt(null)
      return
    }
    setOpenPrompt(agent.id)
    if (promptContents[agent.id] !== undefined) return

    setPromptLoading(prev => ({ ...prev, [agent.id]: true }))
    try {
      const res = await fetch(`/api/agents/${agent.id}`)
      if (res.ok) {
        const data = await res.json()
        setPromptContents(prev => ({ ...prev, [agent.id]: data.content ?? "" }))
      } else {
        setPromptContents(prev => ({
          ...prev,
          [agent.id]: `[오류] 프롬프트를 불러오지 못했습니다 (HTTP ${res.status})`,
        }))
      }
    } catch {
      setPromptContents(prev => ({ ...prev, [agent.id]: "[오류] 프롬프트 로드 실패" }))
    } finally {
      setPromptLoading(prev => ({ ...prev, [agent.id]: false }))
    }
  }

  const savePrompt = async (agentId: string) => {
    setSaving(agentId)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: promptContents[agentId] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setToast({ message: language === "ko" ? "저장되었습니다." : "Saved.", type: "success" })
    } catch {
      setToast({ message: language === "ko" ? "저장에 실패했습니다." : "Save failed.", type: "error" })
    } finally {
      setSaving(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4" />
            : <XCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* 팀 Accordion — 3개 팀만 표시, 클릭 시 에이전트 목록 확장 */}
      <Accordion type="single" collapsible className="space-y-2">
        {GROUPS.map(group => {
          const meta = GROUP_META[group]
          const GroupIcon = meta.icon
          const groupAgents = AGENTS.filter(a => a.group === group)

          return (
            <AccordionItem
              key={group}
              value={group}
              className="border border-border/50 rounded-xl bg-card/40 overflow-hidden"
            >
              {/* 팀 헤더 — 클릭 시 확장 */}
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg ${meta.bgClass} flex items-center justify-center shrink-0`}>
                    <GroupIcon className={`w-5 h-5 ${meta.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{group}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.badgeClass}`}>
                        {groupAgents.length}{language === "ko" ? "명" : " agents"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {language === "ko" ? meta.descKo : meta.descEn}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>

              {/* 에이전트 목록 */}
              <AccordionContent className="px-0 pb-0">
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {groupAgents.map(agent => {
                    const isPromptOpen = openPrompt === agent.id
                    const isInline = agent.promptPath === "inline" || agent.promptPath.startsWith("inline")

                    return (
                      <div key={agent.id}>
                        {/* 에이전트 행 */}
                        <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                          {/* 상태 dot */}
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            agent.status === "active" ? "bg-green-500" : "bg-gray-500"
                          }`} />

                          {/* 이름 + 역할 */}
                          <div className="flex-1 min-w-0">
                            {(() => {
                              const sep = " — "
                              const koName = agent.roleKo.includes(sep) ? agent.roleKo.split(sep)[0] : agent.roleKo
                              const enName = agent.roleEn.includes(sep) ? agent.roleEn.split(sep)[0] : agent.roleEn
                              const koDesc = agent.roleKo.includes(sep) ? agent.roleKo.substring(agent.roleKo.indexOf(sep) + sep.length) : ""
                              const enDesc = agent.roleEn.includes(sep) ? agent.roleEn.substring(agent.roleEn.indexOf(sep) + sep.length) : ""
                              return (
                                <>
                                  <span className="text-sm font-semibold text-foreground">{koName}</span>
                                  <p className="text-xs text-muted-foreground/50 mt-0.5">({enName})</p>
                                  {(language === "ko" ? koDesc : enDesc) && (
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                      {language === "ko" ? koDesc : enDesc}
                                    </p>
                                  )}
                                </>
                              )
                            })()}
                          </div>

                          {/* 프롬프트 확인 버튼 */}
                          {!isInline && (
                            <Button
                              variant={isPromptOpen ? "secondary" : "outline"}
                              size="sm"
                              className="shrink-0 h-7 px-3 text-xs gap-1.5"
                              onClick={() => handlePromptClick(agent)}
                            >
                              <FileText className="w-3 h-3" />
                              {isPromptOpen
                                ? (language === "ko" ? "닫기" : "Close")
                                : (language === "ko" ? "프롬프트 확인" : "View Prompt")}
                            </Button>
                          )}
                          {isInline && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground/60 border-border/30 shrink-0">
                              inline
                            </Badge>
                          )}
                        </div>

                        {/* 프롬프트 패널 — 해당 에이전트 바로 아래 확장 */}
                        {isPromptOpen && (
                          <div className="px-5 pb-4 pt-2 bg-muted/10 border-t border-border/20 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono">{agent.promptPath}</span>
                            </div>

                            {promptLoading[agent.id] ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{language === "ko" ? "프롬프트 로딩 중..." : "Loading..."}</span>
                              </div>
                            ) : (
                              <>
                                <Textarea
                                  value={promptContents[agent.id] ?? ""}
                                  onChange={e =>
                                    setPromptContents(prev => ({ ...prev, [agent.id]: e.target.value }))
                                  }
                                  rows={14}
                                  className="font-mono text-xs resize-y bg-background/60"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setOpenPrompt(null)}
                                  >
                                    {language === "ko" ? "닫기" : "Close"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => savePrompt(agent.id)}
                                    disabled={saving === agent.id}
                                  >
                                    {saving === agent.id
                                      ? (language === "ko" ? "저장 중..." : "Saving...")
                                      : (language === "ko" ? "저장" : "Save")}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
