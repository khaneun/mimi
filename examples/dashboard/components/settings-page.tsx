"use client"

import { useState, useEffect } from "react"
import { Settings, RefreshCw, CheckCircle, AlertCircle, Building2, ToggleLeft, ToggleRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

interface SettingsData {
  kis_mode: string
  kis_enabled: boolean
  available_modes: { value: string; label: string; description: string }[]
}

export function SettingsPage() {
  const { language } = useLanguage()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMode, setSavedMode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle")

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      const data = await res.json()
      setSettings(data)
      setSavedMode(data.kis_mode)
    } catch (e) {
      setError("설정을 불러오지 못했습니다.")
    }
    setLoading(false)
  }

  const handleModeChange = async (mode: string) => {
    if (!settings || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kis_mode: mode }),
      })
      const data = await res.json()
      if (data.success) {
        setSettings((prev) => prev ? { ...prev, kis_mode: data.kis_mode } : prev)
        setSavedMode(data.kis_mode)
      } else {
        setError(data.error || "설정 저장 실패")
      }
    } catch (e) {
      setError("설정 저장 중 오류가 발생했습니다.")
    }
    setSaving(false)
  }

  const handlePortfolioSync = async () => {
    setSyncStatus("syncing")
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: settings?.kis_mode }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncStatus("done")
        setTimeout(() => setSyncStatus("idle"), 3000)
      } else {
        setSyncStatus("error")
        setError(data.error || "동기화 실패")
        setTimeout(() => setSyncStatus("idle"), 5000)
      }
    } catch (e) {
      setSyncStatus("error")
      setError("포트폴리오 동기화 중 오류가 발생했습니다.")
      setTimeout(() => setSyncStatus("idle"), 5000)
    }
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
          <h2 className="text-xl font-bold">
            {language === "ko" ? "설정" : "Settings"}
          </h2>
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
        </div>
      )}

      {/* KIS 계좌 설정 */}
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
              : "Choose between paper trading (practice) or live trading mode"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 모드 토글 */}
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
                      ? m.value === "paper"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-emerald-500 bg-emerald-500/10"
                      : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50"
                    }
                    ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {isActive && (
                    <span className="absolute top-2 right-2">
                      {m.value === "paper"
                        ? <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500"><CheckCircle className="w-3 h-3 text-white" /></span>
                        : <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500"><CheckCircle className="w-3 h-3 text-white" /></span>
                      }
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
                    <Badge
                      variant="secondary"
                      className={`text-[10px] mt-1 ${m.value === "paper" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}
                    >
                      {language === "ko" ? "현재 모드" : "Active"}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>

          {/* 현재 모드 표시 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="text-sm text-muted-foreground">
              {language === "ko" ? "현재 설정" : "Current setting"}
            </div>
            <Badge
              variant="outline"
              className={settings?.kis_mode === "real"
                ? "border-emerald-500/40 text-emerald-400"
                : "border-blue-500/40 text-blue-400"
              }
            >
              한국투자증권 · {settings?.kis_mode === "real" ? "실전투자" : "모의투자"}
            </Badge>
          </div>

          {saving && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
              {language === "ko" ? "설정 저장 중..." : "Saving..."}
            </p>
          )}
          {!saving && savedMode && savedMode === settings?.kis_mode && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {language === "ko" ? "설정이 저장되었습니다" : "Settings saved"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 포트폴리오 동기화 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">
              {language === "ko" ? "포트폴리오 동기화" : "Portfolio Sync"}
            </CardTitle>
          </div>
          <CardDescription>
            {language === "ko"
              ? "한국투자증권 API에서 실시간 잔고를 가져옵니다"
              : "Fetch live balance from KIS API"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {language === "ko"
                ? "포트폴리오 탭의 종목 데이터를 KIS 계좌 잔고로 업데이트합니다."
                : "Update portfolio holdings with actual KIS account balance."}
            </div>
          </div>
          <Button
            onClick={handlePortfolioSync}
            disabled={syncStatus === "syncing"}
            className="gap-2"
            variant={syncStatus === "done" ? "outline" : "default"}
          >
            {syncStatus === "syncing" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {language === "ko" ? "동기화 중..." : "Syncing..."}
              </>
            ) : syncStatus === "done" ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {language === "ko" ? "동기화 완료" : "Synced"}
              </>
            ) : syncStatus === "error" ? (
              <>
                <AlertCircle className="w-4 h-4 text-red-400" />
                {language === "ko" ? "동기화 실패" : "Sync Failed"}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {language === "ko" ? "지금 동기화" : "Sync Now"}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            {language === "ko"
              ? "* KIS API가 설정된 경우에만 동작합니다. 장 운영 시간(09:00~15:30)에 사용하세요."
              : "* Works only when KIS API is configured. Use during market hours (09:00~15:30)."}
          </p>
        </CardContent>
      </Card>

      {/* 시스템 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "ko" ? "시스템 정보" : "System Info"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">LLM</span>
              <Badge variant="outline" className="text-[11px]">Claude Code CLI</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === "ko" ? "시장 데이터" : "Market Data"}</span>
              <Badge variant="outline" className="text-[11px]">pykrx · KIS API</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === "ko" ? "알림" : "Notifications"}</span>
              <Badge variant="outline" className="text-[11px]">Telegram</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === "ko" ? "스케줄러" : "Scheduler"}</span>
              <Badge variant="outline" className="text-[11px]">crontab · 21:00 KST</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
