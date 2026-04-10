"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Landmark, CandlestickChart, Code2, CheckCircle, XCircle, FileText, ChevronDown, Loader2 } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

// --- Types ---

type AgentGroup = "Investment Alpha" | "MarketPulse" | "Dev Team"
type LlmRequirement = "API" | "CLI"

interface Agent {
  id: string
  name: string
  description: string
  descriptionEn: string
  group: AgentGroup
  promptPath: string
  llm: LlmRequirement
  status: "active" | "inactive"
}

// --- Agent Data ---

const AGENTS: Agent[] = [
  // Investment Alpha
  {
    id: "macro-economist",
    name: "macro-economist",
    description: "거시경제 분석가 — Fed 금리, 인플레이션, GDP, 환율 분석",
    descriptionEn: "Macro Economist — Fed rates, inflation, GDP, FX analysis",
    group: "Investment Alpha",
    promptPath: ".claude/agents/macro-economist.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "commodity-analyst",
    name: "commodity-analyst",
    description: "원자재 분석가 — 금/은/원유, 중앙은행 매입, 산업 수요",
    descriptionEn: "Commodity Analyst — Gold/Silver/Oil, central bank purchases, industrial demand",
    group: "Investment Alpha",
    promptPath: ".claude/agents/commodity-analyst.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "stock-analyst",
    name: "stock-analyst",
    description: "주식 분석가 — S&P500, KOSPI, 섹터 분석, 30종목 추천",
    descriptionEn: "Stock Analyst — S&P500, KOSPI, sector analysis, top 30 picks",
    group: "Investment Alpha",
    promptPath: ".claude/agents/stock-analyst.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "real-estate-analyst",
    name: "real-estate-analyst",
    description: "부동산 분석가 — 서울/수도권, REITs, 정책 분석",
    descriptionEn: "Real Estate Analyst — Seoul/metro, REITs, policy analysis",
    group: "Investment Alpha",
    promptPath: ".claude/agents/real-estate-analyst.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "chief-analyst",
    name: "chief-analyst",
    description: "종합 분석가 — 4명 리포트 종합, 포트폴리오 전략",
    descriptionEn: "Chief Analyst — Synthesizes 4 reports, portfolio strategy",
    group: "Investment Alpha",
    promptPath: ".claude/agents/chief-analyst.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "monthly-reporter",
    name: "monthly-reporter",
    description: "월별 리포터 — 월별 시장 분석 + 매매 성과 리포트",
    descriptionEn: "Monthly Reporter — Monthly market analysis + trading performance report",
    group: "Investment Alpha",
    promptPath: ".claude/agents/monthly-reporter.md",
    llm: "CLI",
    status: "active",
  },
  // MarketPulse
  {
    id: "technical-analyst",
    name: "technical-analyst",
    description: "기술 분석가 — OHLCV, MA, RSI, MACD, 볼린저밴드",
    descriptionEn: "Technical Analyst — OHLCV, MA, RSI, MACD, Bollinger Bands",
    group: "MarketPulse",
    promptPath: "pipeline/stock_pipeline.py (inline)",
    llm: "CLI",
    status: "active",
  },
  {
    id: "trading-flow-analyst",
    name: "trading-flow-analyst",
    description: "수급 분석가 — 기관/외국인/개인 투자자 거래 동향",
    descriptionEn: "Trading Flow Analyst — Institutional/foreign/retail investor flow",
    group: "MarketPulse",
    promptPath: "inline",
    llm: "CLI",
    status: "active",
  },
  {
    id: "financial-analyst",
    name: "financial-analyst",
    description: "재무 분석가 — EPS, PER, PBR, ROE, 배당",
    descriptionEn: "Financial Analyst — EPS, PER, PBR, ROE, dividends",
    group: "MarketPulse",
    promptPath: "inline",
    llm: "CLI",
    status: "active",
  },
  {
    id: "news-analyst",
    name: "news-analyst",
    description: "뉴스 분석가 — 뉴스/이벤트 분석, 촉매 요인",
    descriptionEn: "News Analyst — News/event analysis, catalysts",
    group: "MarketPulse",
    promptPath: "inline",
    llm: "CLI",
    status: "active",
  },
  {
    id: "market-analyst",
    name: "market-analyst",
    description: "시장 분석가 — KOSPI/KOSDAQ 맥락, 종목 포지셔닝",
    descriptionEn: "Market Analyst — KOSPI/KOSDAQ context, stock positioning",
    group: "MarketPulse",
    promptPath: "inline",
    llm: "CLI",
    status: "active",
  },
  {
    id: "investment-strategist",
    name: "investment-strategist",
    description: "투자 전략가 — 6명 분석 종합, 최종 투자 의견",
    descriptionEn: "Investment Strategist — Synthesizes 6 analyses, final investment opinion",
    group: "MarketPulse",
    promptPath: "inline",
    llm: "CLI",
    status: "active",
  },
  // Dev Team
  {
    id: "solution-architect",
    name: "solution-architect",
    description: "솔루션 아키텍트 — Harness Pattern 설계, 팀 조율",
    descriptionEn: "Solution Architect — Harness Pattern design, team coordination",
    group: "Dev Team",
    promptPath: ".claude/agents/solution-architect.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "frontend-developer",
    name: "frontend-developer",
    description: "프론트엔드 개발자 — Next.js 대시보드 개발",
    descriptionEn: "Frontend Developer — Next.js dashboard development",
    group: "Dev Team",
    promptPath: ".claude/agents/frontend-developer.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "qa-engineer",
    name: "qa-engineer",
    description: "QA 엔지니어 — E2E 테스트, 데이터 검증",
    descriptionEn: "QA Engineer — E2E testing, data validation",
    group: "Dev Team",
    promptPath: ".claude/agents/qa-engineer.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "devops-engineer",
    name: "devops-engineer",
    description: "DevOps 엔지니어 — 빌드/배포, 모니터링",
    descriptionEn: "DevOps Engineer — Build/deploy, monitoring",
    group: "Dev Team",
    promptPath: ".claude/agents/devops-engineer.md",
    llm: "CLI",
    status: "active",
  },
  {
    id: "ux-reviewer",
    name: "ux-reviewer",
    description: "UX 리뷰어 — 사용성/접근성 검증",
    descriptionEn: "UX Reviewer — Usability/accessibility review",
    group: "Dev Team",
    promptPath: ".claude/agents/ux-reviewer.md",
    llm: "CLI",
    status: "active",
  },
]

// --- Style helpers ---

const GROUP_BADGE_STYLES: Record<AgentGroup, string> = {
  "Investment Alpha": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "MarketPulse": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Dev Team": "bg-purple-500/15 text-purple-400 border-purple-500/30",
}

const GROUP_ICON: Record<AgentGroup, React.ComponentType<{ className?: string }>> = {
  "Investment Alpha": Landmark,
  "MarketPulse": CandlestickChart,
  "Dev Team": Code2,
}

const GROUP_ICON_COLOR: Record<AgentGroup, string> = {
  "Investment Alpha": "text-blue-400",
  "MarketPulse": "text-emerald-400",
  "Dev Team": "text-purple-400",
}

const GROUP_BG: Record<AgentGroup, string> = {
  "Investment Alpha": "bg-blue-500/10",
  "MarketPulse": "bg-emerald-500/10",
  "Dev Team": "bg-purple-500/10",
}

// --- Component ---

export function AgentsPage() {
  const { language } = useLanguage()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [promptContents, setPromptContents] = useState<Record<string, string>>({})
  const [promptLoading, setPromptLoading] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const groups: AgentGroup[] = ["Investment Alpha", "MarketPulse", "Dev Team"]

  const groupSummaries = groups.map(group => ({
    group,
    count: AGENTS.filter(a => a.group === group).length,
    Icon: GROUP_ICON[group],
    color: GROUP_ICON_COLOR[group],
    bgColor: GROUP_BG[group],
  }))

  const loadPrompt = async (agentId: string) => {
    if (selectedAgent === agentId) {
      setSelectedAgent(null)
      return
    }
    setSelectedAgent(agentId)
    if (promptContents[agentId] !== undefined) return
    setPromptLoading(prev => ({ ...prev, [agentId]: true }))
    try {
      const res = await fetch(`/api/agents/${agentId}`)
      if (res.ok) {
        const data = await res.json()
        setPromptContents(prev => ({ ...prev, [agentId]: data.content ?? "" }))
      } else {
        setPromptContents(prev => ({
          ...prev,
          [agentId]: `[오류] 프롬프트를 불러오지 못했습니다 (HTTP ${res.status})`,
        }))
      }
    } catch {
      setPromptContents(prev => ({ ...prev, [agentId]: "[오류] 프롬프트 로드 실패" }))
    } finally {
      setPromptLoading(prev => ({ ...prev, [agentId]: false }))
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
      setToast({
        message: language === "ko" ? "저장되었습니다." : "Saved successfully.",
        type: "success",
      })
    } catch {
      setToast({
        message: language === "ko" ? "저장에 실패했습니다." : "Failed to save.",
        type: "error",
      })
    } finally {
      setSaving(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {groupSummaries.map(({ group, count, Icon, color, bgColor }) => (
          <Card key={group} className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-4">
              <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{group}</p>
                <p className="text-2xl font-bold text-foreground">
                  {count}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {language === "ko" ? "명" : "agents"}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Groups — Accordion */}
      <Accordion type="multiple" defaultValue={["Investment Alpha"]} className="space-y-3">
        {groups.map(group => {
          const groupAgents = AGENTS.filter(a => a.group === group)
          const GroupIcon = GROUP_ICON[group]
          return (
            <AccordionItem
              key={group}
              value={group}
              className="border border-border/50 rounded-lg bg-card/30 overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-md ${GROUP_BG[group]} flex items-center justify-center shrink-0`}>
                    <GroupIcon className={`w-4 h-4 ${GROUP_ICON_COLOR[group]}`} />
                  </div>
                  <span className="font-semibold text-foreground">{group}</span>
                  <Badge variant="outline" className={`text-xs ${GROUP_BADGE_STYLES[group]}`}>
                    {groupAgents.length} {language === "ko" ? "명" : "agents"}
                  </Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 pb-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupAgents.map(agent => {
                    const isOpen = selectedAgent === agent.id
                    return (
                      <div key={agent.id} className="space-y-2">
                        {/* Agent Card */}
                        <Card
                          className={`border-border/50 bg-card/50 cursor-pointer hover:border-border transition-colors ${
                            isOpen ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={() => loadPrompt(agent.id)}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    agent.status === "active" ? "bg-green-500" : "bg-gray-500"
                                  }`}
                                />
                                <span className="text-sm font-semibold text-foreground">
                                  {agent.name}
                                </span>
                              </div>
                              <ChevronDown
                                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {language === "ko" ? agent.description : agent.descriptionEn}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${GROUP_BADGE_STYLES[agent.group]}`}>
                                {agent.group}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] bg-sky-500/15 text-sky-400 border-sky-500/30">
                                Claude CLI
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Inline Prompt Panel */}
                        {isOpen && (
                          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1.5">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono truncate">{agent.promptPath}</span>
                            </div>

                            {promptLoading[agent.id] ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{language === "ko" ? "로딩 중..." : "Loading..."}</span>
                              </div>
                            ) : (
                              <>
                                <Textarea
                                  value={promptContents[agent.id] ?? ""}
                                  onChange={e =>
                                    setPromptContents(prev => ({
                                      ...prev,
                                      [agent.id]: e.target.value,
                                    }))
                                  }
                                  rows={12}
                                  className="font-mono text-xs resize-y"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => setSelectedAgent(null)}
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
