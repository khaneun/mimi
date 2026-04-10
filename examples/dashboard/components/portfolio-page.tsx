"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Wallet, ArrowUpDown, ArrowUp, ArrowDown, Search, TrendingUp, TrendingDown, Coins, AlertCircle } from "lucide-react"
import { getNaverChartUrl } from "@/lib/naver-chart"
import { MiniCandle } from "@/components/mini-candle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useLanguage } from "@/components/language-provider"

interface Stock {
  name: string
  code: string
  quantity: number
  avg_price: number
  current_price?: number
  eval_amount?: number
  profit_amount?: number
  profit_rate?: number
  sector?: string
}

const SECTOR_COLORS: Record<string, string> = {
  '반도체': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  '반도체장비': 'bg-blue-500/10 text-blue-300 border-blue-400/20',
  '자동차': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  '자동차부품': 'bg-slate-500/10 text-slate-300 border-slate-400/20',
  '에너지': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  '방산': 'bg-red-500/15 text-red-400 border-red-500/30',
  '방산ETF': 'bg-red-500/10 text-red-300 border-red-400/20',
  '인터넷': 'bg-green-500/15 text-green-400 border-green-500/30',
  '전력': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  '해외ETF': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  '지주ETF': 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  '채권ETF': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  '로봇ETF': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  '중공업ETF': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  '금ETF': 'bg-yellow-600/15 text-yellow-500 border-yellow-600/30',
  '금현물': 'bg-yellow-600/20 text-yellow-500 border-yellow-600/40',
}

interface Account {
  name: string
  type: string
  mode?: string
  mode_label?: string
  account_number?: string
  stocks: Stock[]
  summary?: {
    total_eval_amount?: number
    total_profit_amount?: number
    total_profit_rate?: number
    deposit?: number
    available_amount?: number
  }
}

interface PortfolioData {
  accounts: Account[]
  synced_at?: string
  kis_mode?: string
}

const STORAGE_KEY = "portfolio_data_v1"

export function PortfolioPage() {
  const { language } = useLanguage()
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [editStock, setEditStock] = useState<{ accountIdx: number; stockIdx: number; stock: Stock } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ accountIdx: number; stockIdx: number } | null>(null)
  const [priceMap, setPriceMap] = useState<Record<string, number>>({})
  const [changeMap, setChangeMap] = useState<Record<string, { change: number; change_rate: number }>>({})
  const [sortKey, setSortKey] = useState<string>("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [filterText, setFilterText] = useState("")

  // Form state for add/edit
  const [formName, setFormName] = useState("")
  const [formCode, setFormCode] = useState("")
  const [formQuantity, setFormQuantity] = useState("")
  const [formAvgPrice, setFormAvgPrice] = useState("")

  const loadPortfolioData = useCallback(async () => {
    // 1) GET으로 캐시 즉시 표시 (빠름)
    try {
      const res = await fetch("/api/portfolio?" + Date.now())
      const data: PortfolioData = await res.json()
      if (data?.accounts?.length > 0) {
        setPortfolioData(data)
      }
    } catch {}

    // 2) POST로 KIS 실시간 갱신 (백그라운드, 캐시 없으면 표시까지 대기)
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success && data.data?.accounts?.length > 0) {
        setPortfolioData(data.data)
      }
    } catch (e: any) {
      setSyncError("KIS 연결 오류: " + e.message)
    } finally {
      setSyncing(false)
    }
  }, [])

  // 마운트 시 자동 로드 (캐시 즉시 표시 → KIS 실시간 갱신)
  useEffect(() => {
    loadPortfolioData()
  }, [loadPortfolioData])

  // 투자 모드 변경 시 → 새 계좌로 재동기화 후 UI 갱신
  useEffect(() => {
    const handler = async (e: Event) => {
      const newMode = (e as CustomEvent).detail.mode as string
      setSyncing(true)
      setSyncError(null)
      try {
        const res = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: newMode }),
        })
        const json = await res.json()
        if (json.success && json.data?.accounts?.length > 0) {
          setPortfolioData(json.data)
        } else {
          loadPortfolioData()
        }
      } catch {
        loadPortfolioData()
      } finally {
        setSyncing(false)
      }
    }
    window.addEventListener("kis-mode-changed", handler)
    return () => window.removeEventListener("kis-mode-changed", handler)
  }, [loadPortfolioData])

  // 현재가 로드: KIS API stock.current_price 우선, 없으면 dashboard_data.json
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const resp = await fetch("/dashboard_data.json")
        const data = await resp.json()
        const map: Record<string, number> = {}
        const cmap: Record<string, { change: number; change_rate: number }> = {}
        for (const h of [...(data.holdings ?? []), ...(data.watchlist ?? [])]) {
          if (h.ticker && h.current_price) {
            map[h.ticker] = h.current_price
            if (h.change != null && h.change_rate != null) {
              cmap[h.ticker] = { change: h.change, change_rate: h.change_rate }
            }
          }
        }
        setPriceMap(map)
        setChangeMap(cmap)
      } catch {}
    }
    loadPrices()
    const interval = setInterval(loadPrices, 60000)
    return () => clearInterval(interval)
  }, [])

  // KIS API current_price가 있는 종목은 priceMap에 우선 반영
  useEffect(() => {
    if (!portfolioData) return
    const kisMap: Record<string, number> = {}
    for (const acc of portfolioData.accounts) {
      for (const s of acc.stocks) {
        if (s.current_price && s.current_price > 0) {
          kisMap[s.code] = s.current_price
        }
      }
    }
    if (Object.keys(kisMap).length > 0) {
      setPriceMap((prev) => ({ ...prev, ...kisMap }))
    }
  }, [portfolioData])

  // KIS API 실시간 동기화
  const syncFromKIS = useCallback(async () => {
    setSyncing(true); setSyncError(null)
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setPortfolioData(data.data)
      } else {
        setSyncError(data.error || "KIS 동기화 실패")
      }
    } catch (e: any) {
      setSyncError("KIS 연결 오류: " + e.message)
    }
    setSyncing(false)
  }, [])

  // Save to state (CRUD)
  const saveData = useCallback((data: PortfolioData) => {
    setPortfolioData(data)
  }, [])

  const [formLookupLoading, setFormLookupLoading] = useState(false)
  const [formCurrentPrice, setFormCurrentPrice] = useState<number | null>(null)

  const resetForm = () => {
    setFormName("")
    setFormCode("")
    setFormQuantity("")
    setFormAvgPrice("")
    setFormCurrentPrice(null)
    setFormLookupLoading(false)
  }

  // 티커 입력 시 종목명+현재가 자동 조회 (dashboard_data.json에서)
  const lookupTicker = async (code: string) => {
    if (!code || code.length < 5) {
      setFormName("")
      setFormCurrentPrice(null)
      return
    }
    setFormLookupLoading(true)
    try {
      const resp = await fetch(`/dashboard_data.json?t=${Date.now()}`)
      const data = await resp.json()
      // holdings + watchlist에서 찾기
      const all = [...(data.holdings || []), ...(data.watchlist || [])]
      const found = all.find((s: any) => s.ticker === code || s.code === code)
      if (found) {
        setFormName(found.company_name || found.name || "")
        setFormCurrentPrice(found.current_price || null)
        if (!formAvgPrice) setFormAvgPrice(String(found.current_price || ""))
      } else {
        // pykrx API로 종목명 조회 시도 (stock_map.json)
        try {
          const mapResp = await fetch(`/dashboard_data.json?t=${Date.now()}`)
          const mapData = await mapResp.json()
          // 못 찾으면 코드만 표시
          setFormName("")
          setFormCurrentPrice(null)
        } catch {}
      }
    } catch {}
    setFormLookupLoading(false)
  }

  const handleAdd = () => {
    if (!portfolioData || !formCode || !formQuantity || !formAvgPrice) return
    const newData = { ...portfolioData, accounts: portfolioData.accounts.map((a, i) => {
      if (i !== 0) return a
      return {
        ...a,
        stocks: [...a.stocks, {
          name: formName || formCode,
          code: formCode,
          quantity: parseInt(formQuantity),
          avg_price: parseInt(formAvgPrice),
        }],
      }
    })}
    saveData(newData)
    setShowAddModal(false)
    resetForm()
  }

  const handleEdit = () => {
    if (!portfolioData || !editStock || !formQuantity || !formAvgPrice) return
    const newData = { ...portfolioData, accounts: portfolioData.accounts.map((a, i) => {
      if (i !== editStock.accountIdx) return a
      return {
        ...a,
        stocks: a.stocks.map((s, j) => {
          if (j !== editStock.stockIdx) return s
          return {
            ...s,
            name: formName || s.name,
            code: formCode || s.code,
            quantity: parseInt(formQuantity),
            avg_price: parseInt(formAvgPrice),
          }
        }),
      }
    })}
    saveData(newData)
    setEditStock(null)
    resetForm()
  }

  const handleDelete = () => {
    if (!portfolioData || !deleteConfirm) return
    const newData = { ...portfolioData, accounts: portfolioData.accounts.map((a, i) => {
      if (i !== deleteConfirm.accountIdx) return a
      return {
        ...a,
        stocks: a.stocks.filter((_, j) => j !== deleteConfirm.stockIdx),
      }
    })}
    saveData(newData)
    setDeleteConfirm(null)
  }

  const openEditModal = (accountIdx: number, stockIdx: number, stock: Stock) => {
    setEditStock({ accountIdx, stockIdx, stock })
    setFormName(stock.name)
    setFormCode(stock.code)
    setFormQuantity(stock.quantity.toString())
    setFormAvgPrice(stock.avg_price.toString())
  }

  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
  }

  if (!portfolioData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "ko" ? "포트폴리오 로딩 중..." : "Loading portfolio..."}
          </p>
        </div>
      </div>
    )
  }

  // 모든 계좌 종목 통합 (단일 한국투자증권 뷰)
  const account: Account = {
    name: "한국투자증권",
    type: "KIS",
    mode_label: portfolioData.accounts[0]?.mode_label,
    stocks: portfolioData.accounts.flatMap(a => a.stocks),
    summary: portfolioData.accounts[0]?.summary,
  }

  const totalInvested = account.stocks.reduce((sum, s) => sum + s.quantity * s.avg_price, 0)

  return (
    <div className="space-y-6">
      {/* KIS 계좌 상태 */}
      <div className="flex items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <span>한국투자증권</span>
          {account.mode_label && (
            <Badge variant="outline" className={`text-[10px] ${account.mode_label === "실전투자" ? "border-emerald-500/40 text-emerald-400" : "border-blue-500/40 text-blue-400"}`}>
              {account.mode_label}
            </Badge>
          )}
          {portfolioData.synced_at && (
            <span className="text-[10px] text-muted-foreground/70">
              · {new Date(portfolioData.synced_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 기준
            </span>
          )}
        </p>
      </div>

      {/* 동기화 오류 */}
      {syncError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{syncError}</span>
          <button onClick={() => setSyncError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* KIS 계좌 요약 (실전/모의 모두 표시) */}
      {account.summary && Object.keys(account.summary).length > 0 && (() => {
        const s = account.summary!
        const totalEval = s.total_eval_amount ?? 0
        const profit = s.total_profit_amount ?? 0
        const profitRate = s.total_profit_rate ?? 0
        const deposit = s.deposit ?? 0
        const isPaper = portfolioData.kis_mode === "paper"
        const isProfit = profit >= 0
        const bgClass = isPaper
          ? "bg-blue-500/5 border-blue-500/20"
          : isProfit ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
        const profitColorClass = isPaper
          ? (isProfit ? "text-blue-400" : "text-blue-300")
          : (isProfit ? "text-emerald-400" : "text-red-400")
        const titleText = isPaper
          ? (language === "ko" ? "KIS 모의투자 계좌 현황" : "KIS Paper Account")
          : (language === "ko" ? "KIS 계좌 실시간 현황" : "KIS Live Account")
        return (
          <div className={`rounded-xl px-4 py-3 border ${bgClass}`}>
            <div className="flex items-center gap-1.5 mb-2">
              {isPaper
                ? <Wallet className="w-4 h-4 text-blue-400" />
                : isProfit ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />
              }
              <span className="text-sm font-semibold">{titleText}</span>
              {isPaper && (
                <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400 ml-1">
                  {language === "ko" ? "모의투자" : "Paper"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">{language === "ko" ? "총 평가금" : "Total Value"}</p>
                <p className="font-bold">{totalEval.toLocaleString()}<span className="text-xs text-muted-foreground ml-1">원</span></p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">{language === "ko" ? "평가손익" : "P&L"}</p>
                <p className={`font-bold ${profitColorClass}`}>
                  {profit >= 0 ? "+" : ""}{profit.toLocaleString()}<span className="text-xs ml-1">({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(2)}%)</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">{language === "ko" ? "예수금" : "Cash"}</p>
                <p className="font-bold">{deposit.toLocaleString()}<span className="text-xs text-muted-foreground ml-1">원</span></p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">{language === "ko" ? "보유 종목" : "Holdings"}</p>
                <p className="font-bold">{account.stocks.length}<span className="text-xs text-muted-foreground ml-1">{language === "ko" ? "종목" : "stocks"}</span></p>
              </div>
            </div>
          </div>
        )
      })()}


      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{language === "ko" ? "총 투자금" : "Total Invested"}</p>
            <p className="text-2xl font-bold">{totalInvested.toLocaleString()}<span className="text-sm text-muted-foreground ml-1">{language === "ko" ? "원" : "KRW"}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{language === "ko" ? "총 평가금" : "Total Value"}</p>
            {(() => {
              const totalValue = account.stocks.reduce((s, st) => s + (priceMap[st.code] ?? st.avg_price) * st.quantity, 0)
              const totalReturn = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
              return (
                <div>
                  <p className="text-2xl font-bold">{totalValue.toLocaleString()}<span className="text-sm text-muted-foreground ml-1">{language === "ko" ? "원" : "KRW"}</span></p>
                  <p className={`text-sm font-semibold ${totalReturn >= 0 ? "text-red-400" : "text-blue-400"}`}>
                    {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}% ({((totalValue - totalInvested) >= 0 ? "+" : "")}{(totalValue - totalInvested).toLocaleString()})
                  </p>
                </div>
              )
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{language === "ko" ? "보유 종목 수" : "Holdings"}</p>
            <p className="text-2xl font-bold">{account.stocks.length}<span className="text-sm text-muted-foreground ml-1">{language === "ko" ? "종목" : "stocks"}</span></p>
          </CardContent>
        </Card>
        {!account.summary?.deposit && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{language === "ko" ? "보유 종목 수" : "Holdings"}</p>
              <p className="text-2xl font-bold">{account.stocks.length}<span className="text-sm text-muted-foreground ml-1">{language === "ko" ? "종목" : "stocks"}</span></p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 섹터별 비중 파이 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ko" ? "섹터별 비중" : "Sector Allocation"}</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // 섹터별 투자금 계산
            const sectorMap: Record<string, number> = {}
            account.stocks.forEach(s => {
              const sector = s.sector || (language === "ko" ? "기타" : "Other")
              const value = (priceMap[s.code] ?? s.avg_price) * s.quantity
              sectorMap[sector] = (sectorMap[sector] || 0) + value
            })
            const totalValue = Object.values(sectorMap).reduce((a, b) => a + b, 0)
            const sectors = Object.entries(sectorMap)
              .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
              .sort((a, b) => b.value - a.value)

            // 파이 차트 색상
            const PIE_COLORS = [
              '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
              '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
              '#84cc16', '#e11d48', '#0ea5e9', '#a855f7',
            ]

            // SVG 파이 차트 계산
            let startAngle = 0
            const slices = sectors.map((s, i) => {
              const angle = (s.pct / 100) * 360
              const endAngle = startAngle + angle
              const largeArc = angle > 180 ? 1 : 0
              const startRad = (startAngle - 90) * Math.PI / 180
              const endRad = (endAngle - 90) * Math.PI / 180
              const x1 = 100 + 80 * Math.cos(startRad)
              const y1 = 100 + 80 * Math.sin(startRad)
              const x2 = 100 + 80 * Math.cos(endRad)
              const y2 = 100 + 80 * Math.sin(endRad)
              const path = `M100,100 L${x1},${y1} A80,80 0 ${largeArc},1 ${x2},${y2} Z`
              startAngle = endAngle
              return { ...s, path, color: PIE_COLORS[i % PIE_COLORS.length] }
            })

            // 각 조각의 라벨 위치 계산 (조각 중심각)
            let labelStart = 0
            const slicesWithLabel = slices.map(s => {
              const angle = (s.pct / 100) * 360
              const midAngle = labelStart + angle / 2
              const midRad = (midAngle - 90) * Math.PI / 180
              const labelR = 63  // 라벨 위치 반지름
              const lx = 100 + labelR * Math.cos(midRad)
              const ly = 100 + labelR * Math.sin(midRad)
              labelStart += angle
              return { ...s, lx, ly }
            })

            return (
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* SVG 파이 */}
                <div className="shrink-0 relative group">
                  <svg width="400" height="400" viewBox="0 0 200 200">
                    {slicesWithLabel.map((s, i) => (
                      <g key={s.name} className="cursor-pointer" style={{ transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => {
                          const path = e.currentTarget.querySelector('path')
                          if (path) path.style.transform = 'scale(1.05)'
                          if (path) path.style.transformOrigin = '100px 100px'
                          const info = document.getElementById('pie-hover-info')
                          if (info) info.innerHTML = `<b>${s.name}</b><br/>${s.pct.toFixed(1)}% · ${s.value.toLocaleString()}원`
                        }}
                        onMouseLeave={(e) => {
                          const path = e.currentTarget.querySelector('path')
                          if (path) path.style.transform = 'scale(1)'
                          const info = document.getElementById('pie-hover-info')
                          if (info) info.innerHTML = `${language === "ko" ? "총 평가" : "Total"}<br/><b>${(totalValue / 100000000).toFixed(1)}억</b>`
                        }}
                        onClick={() => setFilterText(s.name)}
                      >
                        <path
                          d={s.path}
                          fill={s.color}
                          stroke="#0f172a"
                          strokeWidth="1"
                          style={{ transition: 'transform 0.2s, filter 0.2s', filter: 'brightness(1)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.3)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                        />
                        {/* 비율 텍스트 (5% 이상만 표시) */}
                        {s.pct >= 5 && (
                          <text
                            x={s.lx}
                            y={s.ly}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-white font-bold pointer-events-none"
                            style={{ fontSize: s.pct >= 15 ? '8px' : '6px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                          >
                            {s.pct.toFixed(0)}%
                          </text>
                        )}
                      </g>
                    ))}
                    {/* 중앙 원 (도넛) + 호버 정보 */}
                    <circle cx="100" cy="100" r="45" fill="#0f172a" />
                    <foreignObject x="60" y="78" width="80" height="44">
                      <div
                        id="pie-hover-info"
                        className="text-center text-foreground"
                        style={{ fontSize: '10px', lineHeight: '1.4' }}
                        dangerouslySetInnerHTML={{
                          __html: `${language === "ko" ? "총 평가" : "Total"}<br/><b>${(totalValue / 100000000).toFixed(1)}억</b>`
                        }}
                      />
                    </foreignObject>
                  </svg>
                </div>
                {/* 범례 */}
                <div className="flex-1 grid grid-cols-2 gap-0.5 w-full">
                  {slices.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.value.toLocaleString()}원</p>
                      </div>
                      <span className="text-xs font-bold shrink-0">{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Holdings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{language === "ko" ? "보유 종목" : "Holdings"}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={language === "ko" ? "종목 검색..." : "Search..."}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-8 h-9 w-40 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  { key: "name", label: language === "ko" ? "종목명" : "Name", align: "left" },
                  { key: "code", label: language === "ko" ? "코드" : "Code", align: "left" },
                  { key: "quantity", label: language === "ko" ? "수량" : "Qty", align: "right" },
                  { key: "avg_price", label: language === "ko" ? "평단가" : "Avg Price", align: "right" },
                  { key: "invested", label: language === "ko" ? "투자금" : "Invested", align: "right" },
                  { key: "current", label: language === "ko" ? "현재가" : "Price", align: "right" },
                  { key: "value", label: language === "ko" ? "평가금" : "Value", align: "right" },
                  { key: "return", label: language === "ko" ? "수익률" : "Return", align: "right" },
                ].map(col => (
                  <TableHead
                    key={col.key}
                    className={`${col.align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-foreground transition-colors`}
                    onClick={() => {
                      if (sortKey === col.key) setSortAsc(!sortAsc)
                      else { setSortKey(col.key); setSortAsc(col.key === "return" ? false : true) }
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">{language === "ko" ? "비중" : "Weight"}</TableHead>
                <TableHead className="text-center">{language === "ko" ? "관리" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.stocks
                .map((stock, idx) => ({ ...stock, _idx: idx }))
                .filter(stock => {
                  if (!filterText) return true
                  const q = filterText.toLowerCase()
                  return stock.name.toLowerCase().includes(q) || stock.code.includes(q) || (stock.sector ?? '').toLowerCase().includes(q)
                })
                .sort((a, b) => {
                  const getVal = (s: typeof a) => {
                    const cp = priceMap[s.code] ?? 0
                    switch (sortKey) {
                      case "name": return s.name
                      case "code": return s.code
                      case "quantity": return s.quantity
                      case "avg_price": return s.avg_price
                      case "invested": return s.quantity * s.avg_price
                      case "current": return cp
                      case "value": return cp * s.quantity
                      case "return": return cp ? ((cp - s.avg_price) / s.avg_price) * 100 : -999
                      default: return s.name
                    }
                  }
                  const va = getVal(a), vb = getVal(b)
                  if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
                  return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number)
                })
                .map((stock) => {
                const idx = stock._idx
                const invested = stock.quantity * stock.avg_price
                const weight = totalInvested > 0 ? (invested / totalInvested) * 100 : 0
                return (
                  <TableRow key={`${stock.code}-${idx}`}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{stock.name}</span>
                        {stock.sector && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SECTOR_COLORS[stock.sector] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            {stock.sector}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {(() => {
                        const url = getNaverChartUrl(stock.code)
                        return url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-foreground cursor-pointer">
                            {stock.code}
                          </a>
                        ) : (
                          <span>{stock.code}</span>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">{stock.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{stock.avg_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{invested.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {priceMap[stock.code] ? (() => {
                        const cp = priceMap[stock.code]
                        const chg = changeMap[stock.code]
                        const prevClose = chg ? cp - chg.change : stock.avg_price
                        return (
                          <div className="flex items-center justify-end gap-1">
                            <div className="text-right">
                              <span className="font-medium">{cp.toLocaleString()}</span>
                              {chg && chg.change !== 0 && (
                                <div className="text-[10px]">
                                  {chg.change_rate >= 0
                                    ? <span className="text-red-400">▲{Math.abs(chg.change).toLocaleString()} (+{chg.change_rate.toFixed(2)}%)</span>
                                    : <span className="text-blue-400">▼{Math.abs(chg.change).toLocaleString()} ({chg.change_rate.toFixed(2)}%)</span>
                                  }
                                </div>
                              )}
                            </div>
                            <MiniCandle
                              open={prevClose}
                              close={cp}
                              high={Math.max(cp, prevClose) * 1.02}
                              low={Math.min(cp, prevClose) * 0.98}
                            />
                          </div>
                        )
                      })() : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {priceMap[stock.code]
                        ? <span className="font-medium">{(priceMap[stock.code] * stock.quantity).toLocaleString()}</span>
                        : <span className="text-muted-foreground text-xs">-</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {priceMap[stock.code] ? (() => {
                        const returnRate = ((priceMap[stock.code] - stock.avg_price) / stock.avg_price) * 100
                        const profitAmount = (priceMap[stock.code] - stock.avg_price) * stock.quantity
                        return (
                          <div>
                            <span className={`font-bold ${returnRate >= 0 ? "text-red-400" : "text-blue-400"}`}>
                              {returnRate >= 0 ? "+" : ""}{returnRate.toFixed(1)}%
                            </span>
                            <p className={`text-[10px] ${profitAmount >= 0 ? "text-red-400/70" : "text-blue-400/70"}`}>
                              {profitAmount >= 0 ? "+" : ""}{profitAmount.toLocaleString()}
                            </p>
                          </div>
                        )
                      })() : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {weight.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditModal(0, idx, stock)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm({ accountIdx: 0, stockIdx: idx })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold">
                  {language === "ko" ? "합계" : "Total"}
                </TableCell>
                <TableCell className="text-right font-bold">{totalInvested.toLocaleString()}</TableCell>
                <TableCell className="text-right font-bold">100%</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Add Stock Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ko" ? "종목 추가" : "Add Stock"}</DialogTitle>
            <DialogDescription>
              {language === "ko" ? "새로운 종목을 포트폴리오에 추가합니다." : "Add a new stock to your portfolio."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 티커 입력 + 조회 버튼 */}
            <div className="grid gap-2">
              <Label>{language === "ko" ? "종목 코드 (티커)" : "Stock Code (Ticker)"}</Label>
              <div className="flex gap-2">
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') lookupTicker(formCode) }}
                  placeholder={language === "ko" ? "예: 005930" : "e.g. 005930"}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => lookupTicker(formCode)}
                  disabled={!formCode || formCode.length < 5 || formLookupLoading}
                >
                  {formLookupLoading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>{language === "ko" ? "조회" : "Search"}</>
                  )}
                </Button>
              </div>
            </div>

            {/* 자동 조회 결과 */}
            {formName && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{formName}</p>
                    <p className="text-xs text-muted-foreground">{formCode}</p>
                  </div>
                  {formCurrentPrice && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "현재가" : "Current"}</p>
                      <p className="font-bold text-foreground">{formCurrentPrice.toLocaleString()}{language === "ko" ? "원" : ""}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 수량 */}
            <div className="grid gap-2">
              <Label>{language === "ko" ? "수량" : "Quantity"}</Label>
              <Input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" />
            </div>

            {/* 평균 단가 (현재가로 자동 채움, 수정 가능) */}
            <div className="grid gap-2">
              <Label>
                {language === "ko" ? "평균 단가" : "Average Price"}
                {formCurrentPrice && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({language === "ko" ? "현재가 자동 입력" : "auto-filled"})
                  </span>
                )}
              </Label>
              <Input type="number" value={formAvgPrice} onChange={(e) => setFormAvgPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === "ko" ? "취소" : "Cancel"}
            </Button>
            <Button onClick={handleAdd} disabled={!formCode || !formQuantity || !formAvgPrice}>
              <Plus className="w-4 h-4 mr-1" />
              {language === "ko" ? "추가" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Modal */}
      <Dialog open={!!editStock} onOpenChange={(open) => { if (!open) { setEditStock(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ko" ? "종목 수정" : "Edit Stock"}</DialogTitle>
            <DialogDescription>
              {editStock?.stock.name} ({editStock?.stock.code})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 종목 코드 + 조회 버튼 */}
            <div className="grid gap-2">
              <Label>{language === "ko" ? "종목 코드 (티커)" : "Stock Code (Ticker)"}</Label>
              <div className="flex gap-2">
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') lookupTicker(formCode) }}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => lookupTicker(formCode)}
                  disabled={!formCode || formCode.length < 5 || formLookupLoading}
                >
                  {formLookupLoading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>{language === "ko" ? "조회" : "Search"}</>
                  )}
                </Button>
              </div>
            </div>

            {/* 조회 결과 */}
            {formName && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{formName}</p>
                    <p className="text-xs text-muted-foreground">{formCode}</p>
                  </div>
                  {formCurrentPrice && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "현재가" : "Current"}</p>
                      <p className="font-bold text-foreground">{formCurrentPrice.toLocaleString()}{language === "ko" ? "원" : ""}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 수량 */}
            <div className="grid gap-2">
              <Label>{language === "ko" ? "수량" : "Quantity"}</Label>
              <Input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} />
            </div>

            {/* 평균 단가 */}
            <div className="grid gap-2">
              <Label>{language === "ko" ? "평균 단가" : "Average Price"}</Label>
              <Input type="number" value={formAvgPrice} onChange={(e) => setFormAvgPrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditStock(null); resetForm(); }}>
              {language === "ko" ? "취소" : "Cancel"}
            </Button>
            <Button onClick={handleEdit} disabled={!formQuantity || !formAvgPrice}>
              <Pencil className="w-4 h-4 mr-1" />
              {language === "ko" ? "저장" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ko" ? "종목 삭제" : "Delete Stock"}</DialogTitle>
            <DialogDescription>
              {deleteConfirm
                ? language === "ko"
                  ? `${portfolioData.accounts[deleteConfirm.accountIdx].stocks[deleteConfirm.stockIdx]?.name}을(를) 삭제하시겠습니까?`
                  : `Are you sure you want to delete ${portfolioData.accounts[deleteConfirm.accountIdx].stocks[deleteConfirm.stockIdx]?.name}?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {language === "ko" ? "취소" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              {language === "ko" ? "삭제" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
