"use client"

import { useState, useEffect, useRef } from "react"
import {
  Settings, CheckCircle, AlertCircle, Building2,
  ToggleLeft, ToggleRight, Bot, LogIn, LogOut,
  ExternalLink, Copy, Loader2, RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

interface SettingsData {
  kis_mode: string
  kis_enabled: boolean
  available_modes: { value: string; label: string; description: string }[]
}

interface ClaudeStatus {
  installed: boolean
  logged_in: boolean
  auth_method?: string
  provider?: string
  login_pending?: boolean
  login_url?: string | null
  bin_path?: string
  error?: string
}

export function SettingsPage() {
  const { language } = useLanguage()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Claude CLI 상태
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null)
  const [claudeLoading, setClaudeLoading] = useState(false)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const [loginPolling, setLoginPolling] = useState(false)
  const [testResult, setTestResult] = useState<"idle" | "testing" | "ok" | "fail">("idle")
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchClaudeStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      setSettings(await res.json())
    } catch {
      setError("설정을 불러오지 못했습니다.")
    }
    setLoading(false)
  }

  const fetchClaudeStatus = async () => {
    setClaudeLoading(true)
    try {
      const res = await fetch("/api/claude-login")
      const data = await res.json()
      setClaudeStatus(data)
      if (data.login_pending && data.login_url) {
        setLoginUrl(data.login_url)
        startPolling()
      }
    } catch {}
    setClaudeLoading(false)
  }

  const startPolling = () => {
    setLoginPolling(true)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/claude-login")
        const data = await res.json()
        setClaudeStatus(data)
        if (data.logged_in) { stopPolling(); setLoginUrl(null) }
      } catch {}
    }, 3000)
    setTimeout(stopPolling, 300000)
  }

  const stopPolling = () => {
    setLoginPolling(false)
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const handleStartLogin = async () => {
    setError(null); setLoginUrl(null)
    try {
      const res = await fetch("/api/claude-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-login" }),
      })
      const data = await res.json()
      if (data.url) { setLoginUrl(data.url); startPolling() }
      else setError(data.error || "로그인 URL을 가져오지 못했습니다.")
    } catch { setError("로그인 시작 실패") }
  }

  const handleLogout = async () => {
    await fetch("/api/claude-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    })
    setLoginUrl(null); stopPolling(); fetchClaudeStatus()
  }

  const handleCancelLogin = async () => {
    await fetch("/api/claude-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel-login" }),
    })
    setLoginUrl(null); stopPolling(); fetchClaudeStatus()
  }

  const handleTest = async () => {
    setTestResult("testing")
    try {
      const res = await fetch("/api/claude-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      })
      const data = await res.json()
      setTestResult(data.success ? "ok" : "fail")
    } catch { setTestResult("fail") }
    setTimeout(() => setTestResult("idle"), 5000)
  }

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleModeChange = async (mode: string) => {
    if (!settings || saving) return
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kis_mode: mode }),
      })
      const data = await res.json()
      if (data.success) setSettings(prev => prev ? { ...prev, kis_mode: data.kis_mode } : prev)
      else setError(data.error || "설정 저장 실패")
    } catch { setError("설정 저장 중 오류가 발생했습니다.") }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{language === "ko" ? "설정 로딩 중..." : "Loading settings..."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{language === "ko" ? "설정" : "Settings"}</h2>
          <p className="text-sm text-muted-foreground">
            {language === "ko" ? "투자 계좌 및 시스템 설정을 관리합니다" : "Manage account and system settings"}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}

      {/* ── Claude CLI 로그인 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Claude CLI 인증</CardTitle>
          </div>
          <CardDescription>
            {language === "ko"
              ? "AI 에이전트 실행에 필요한 Claude Code CLI 로그인을 관리합니다"
              : "Manage Claude Code CLI login required for AI agent execution"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 상태 표시 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Claude CLI</span>
              {claudeStatus?.bin_path && (
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{claudeStatus.bin_path}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {claudeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : claudeStatus?.installed === false ? (
                <Badge variant="outline" className="border-red-500/40 text-red-400 text-[11px]">미설치</Badge>
              ) : claudeStatus?.logged_in ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[11px]">
                  <CheckCircle className="w-3 h-3 mr-1" />로그인됨
                </Badge>
              ) : loginPolling ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[11px]">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />인증 대기중
                </Badge>
              ) : (
                <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 text-[11px]">
                  <AlertCircle className="w-3 h-3 mr-1" />로그인 필요
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchClaudeStatus}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* 로그인 URL */}
          {loginUrl && (
            <div className="space-y-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <p className="text-sm font-semibold text-amber-300">
                  {language === "ko" ? "브라우저에서 로그인을 완료해주세요" : "Complete login in your browser"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === "ko"
                  ? "아래 URL을 브라우저에서 열고 Claude 계정으로 로그인하세요. 완료 시 자동으로 상태가 업데이트됩니다."
                  : "Open the URL below and sign in with your Claude account."}
              </p>
              <div className="p-2 rounded-lg bg-muted/50 border border-border/30">
                <span className="text-xs font-mono text-foreground break-all leading-relaxed">{loginUrl}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 flex-1" onClick={() => handleCopyUrl(loginUrl)}>
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "복사됨!" : (language === "ko" ? "URL 복사" : "Copy URL")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={loginUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {language === "ko" ? "열기" : "Open"}
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelLogin} className="text-muted-foreground">
                  {language === "ko" ? "취소" : "Cancel"}
                </Button>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex flex-wrap gap-2">
            {!claudeStatus?.logged_in && !loginUrl && (
              <Button onClick={handleStartLogin} className="gap-2" disabled={loginPolling}>
                <LogIn className="w-4 h-4" />
                {language === "ko" ? "Claude 로그인" : "Sign in to Claude"}
              </Button>
            )}
            {claudeStatus?.logged_in && (
              <>
                <Button onClick={handleTest} variant="outline" className="gap-2" disabled={testResult === "testing"}>
                  {testResult === "testing" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{language === "ko" ? "테스트 중..." : "Testing..."}</>
                  ) : testResult === "ok" ? (
                    <><CheckCircle className="w-4 h-4 text-emerald-400" />{language === "ko" ? "정상 작동" : "Working"}</>
                  ) : testResult === "fail" ? (
                    <><AlertCircle className="w-4 h-4 text-red-400" />{language === "ko" ? "오류 발생" : "Error"}</>
                  ) : (
                    <><Bot className="w-4 h-4" />{language === "ko" ? "동작 테스트" : "Test CLI"}</>
                  )}
                </Button>
                <Button onClick={handleLogout} variant="ghost" className="gap-2 text-muted-foreground">
                  <LogOut className="w-4 h-4" />
                  {language === "ko" ? "로그아웃" : "Logout"}
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "ko"
              ? "* claude.ai 계정으로 로그인합니다. API 키가 필요 없습니다."
              : "* Signs in with your claude.ai account. No API key required."}
          </p>
        </CardContent>
      </Card>

      {/* ── KIS 계좌 모드 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">
              {language === "ko" ? "한국투자증권 계좌" : "KIS Account"}
            </CardTitle>
          </div>
          <CardDescription>
            {language === "ko"
              ? "모의투자(연습) 또는 실전투자 모드를 선택합니다"
              : "Choose paper trading or live trading mode"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(settings?.available_modes || []).map((m) => {
              const isActive = settings?.kis_mode === m.value
              return (
                <button
                  key={m.value}
                  onClick={() => handleModeChange(m.value)}
                  disabled={saving}
                  className={`
                    relative flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all duration-200
                    ${isActive
                      ? m.value === "paper" ? "border-blue-500 bg-blue-500/10" : "border-emerald-500 bg-emerald-500/10"
                      : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50"
                    }
                    ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {isActive && (
                    <span className="absolute top-2 right-2">
                      <span className={`flex items-center justify-center w-5 h-5 rounded-full ${m.value === "paper" ? "bg-blue-500" : "bg-emerald-500"}`}>
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {m.value === "paper"
                      ? <ToggleLeft className={`w-5 h-5 ${isActive ? "text-blue-400" : "text-muted-foreground"}`} />
                      : <ToggleRight className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-muted-foreground"}`} />
                    }
                    <span className={`font-semibold text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {m.label}
                    </span>
                  </div>
                  <p className={`text-xs ${isActive ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                    {m.description}
                  </p>
                  {isActive && (
                    <Badge variant="secondary" className={`text-[10px] mt-1 ${m.value === "paper" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                      {language === "ko" ? "현재 모드" : "Active"}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
            <span className="text-sm text-muted-foreground">{language === "ko" ? "현재 설정" : "Current"}</span>
            <Badge variant="outline" className={settings?.kis_mode === "real" ? "border-emerald-500/40 text-emerald-400" : "border-blue-500/40 text-blue-400"}>
              한국투자증권 · {settings?.kis_mode === "real" ? "실전투자" : "모의투자"}
            </Badge>
          </div>
          {saving && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />{language === "ko" ? "저장 중..." : "Saving..."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── 시스템 정보 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ko" ? "시스템 정보" : "System Info"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              ["LLM", "Claude Code CLI"],
              [language === "ko" ? "시장 데이터" : "Market Data", "pykrx · KIS API"],
              [language === "ko" ? "알림" : "Notifications", "Telegram"],
              [language === "ko" ? "스케줄러" : "Scheduler", "crontab · 21:00 KST"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <Badge variant="outline" className="text-[11px]">{value}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
