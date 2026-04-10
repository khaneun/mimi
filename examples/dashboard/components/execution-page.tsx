"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLanguage } from "@/components/language-provider"
import { Activity, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"

// --- Types ---

interface ExecutionItem {
  id: string
  pipeline: "macro" | "stock" | "watchlist" | "news" | "harness" | "realtime"
  agent?: string
  status: "running" | "completed" | "failed" | "queued"
  started_at: string
  completed_at?: string
  duration_sec?: number
  result_summary?: string
  error?: string
}

// --- Constants ---

const PIPELINE_COLORS: Record<string, string> = {
  macro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  stock: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  watchlist: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  news: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  harness: "bg-red-500/20 text-red-400 border-red-500/30",
  realtime: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  queued: "bg-gray-500/20 text-gray-400 border-gray-500/30",
}

const ITEMS_PER_PAGE = 10

// --- Helpers ---

function formatElapsed(sec: number): string {
  if (sec < 60) return `${Math.floor(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

function formatDateTime(iso: string): string {
  try {
    return iso.replace("T", " ").substring(0, 19)
  } catch {
    return iso
  }
}

function getElapsedSec(startedAt: string): number {
  try {
    const start = new Date(startedAt).getTime()
    if (isNaN(start)) return 0
    return Math.max(0, (Date.now() - start) / 1000)
  } catch {
    return 0
  }
}

// --- Component ---

export function ExecutionPage() {
  const { language } = useLanguage()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(Date.now())

  // Fetch data every 60s
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/execution?t=" + Date.now())
        if (res.ok) {
          const data = await res.json()
          setItems(data.items ?? [])
        }
      } catch {}
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  // Tick every second for elapsed time on running items
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(ticker)
  }, [])

  // Derived data
  const runningItems = useMemo(
    () => items.filter((i: ExecutionItem) => i.status === "running"),
    [items]
  )

  const historyItems = useMemo(
    () =>
      items
        .filter((i: ExecutionItem) => i.status === "completed" || i.status === "failed")
        .sort((a: ExecutionItem, b: ExecutionItem) => {
          const ta = a.completed_at ?? a.started_at
          const tb = b.completed_at ?? b.started_at
          return tb.localeCompare(ta)
        }),
    [items]
  )

  // Summary stats
  const totalCount = items.length
  const completedCount = items.filter((i: ExecutionItem) => i.status === "completed").length
  const failedCount = items.filter((i: ExecutionItem) => i.status === "failed").length
  const completedItems = items.filter(
    (i: ExecutionItem) => i.status === "completed" && i.duration_sec != null
  )
  const avgDuration =
    completedItems.length > 0
      ? completedItems.reduce((sum: number, i: ExecutionItem) => sum + (i.duration_sec ?? 0), 0) /
        completedItems.length
      : 0

  // Pagination
  const totalPages = Math.max(1, Math.ceil(historyItems.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pagedItems = historyItems.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  const statusLabel = (status: string): string => {
    if (language === "ko") {
      if (status === "completed") return "성공"
      if (status === "failed") return "실패"
      if (status === "running") return "실행중"
      if (status === "queued") return "대기"
    } else {
      if (status === "completed") return "Completed"
      if (status === "failed") return "Failed"
      if (status === "running") return "Running"
      if (status === "queued") return "Queued"
    }
    return status
  }

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-bold text-foreground">
          {language === "ko" ? "파이프라인 실행 현황" : "Pipeline Execution"}
        </h2>
      </div>

      {/* ===== Running Items ===== */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-400" />
            {language === "ko" ? "현재 실행 중" : "Currently Running"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runningItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {language === "ko"
                ? "현재 실행 중인 작업이 없습니다"
                : "No tasks currently running"}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {runningItems.map((item) => {
                const elapsed = getElapsedSec(item.started_at)
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </span>
                      <span className="text-sm font-semibold text-blue-400">
                        {language === "ko" ? "실행중" : "Running"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${PIPELINE_COLORS[item.pipeline] ?? ""}`}
                      >
                        {item.pipeline}
                      </Badge>
                      {item.agent && (
                        <span className="text-sm text-foreground font-medium">
                          {item.agent}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {language === "ko" ? "시작" : "Started"}:{" "}
                        {formatDateTime(item.started_at)}
                      </span>
                      <span className="font-medium text-blue-400">
                        {language === "ko" ? "경과" : "Elapsed"}:{" "}
                        {formatElapsed(elapsed)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              {language === "ko" ? "전체 실행" : "Total Runs"}
            </p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              {language === "ko" ? "성공" : "Completed"}
            </p>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              {language === "ko" ? "실패" : "Failed"}
            </p>
            <p className="text-2xl font-bold text-red-400">{failedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              {language === "ko" ? "평균 소요 시간" : "Avg Duration"}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {avgDuration > 0 ? formatElapsed(avgDuration) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== History Table ===== */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {language === "ko" ? "실행 이력" : "Execution History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {language === "ko"
                ? "실행 이력이 없습니다"
                : "No execution history"}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>
                      {language === "ko" ? "파이프라인" : "Pipeline"}
                    </TableHead>
                    <TableHead>
                      {language === "ko" ? "에이전트" : "Agent"}
                    </TableHead>
                    <TableHead>
                      {language === "ko" ? "상태" : "Status"}
                    </TableHead>
                    <TableHead>
                      {language === "ko" ? "시작 시간" : "Started"}
                    </TableHead>
                    <TableHead>
                      {language === "ko" ? "소요 시간" : "Duration"}
                    </TableHead>
                    <TableHead>
                      {language === "ko" ? "결과 요약" : "Summary"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((item) => (
                    <TableRow key={item.id} className="border-border/30">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${PIPELINE_COLORS[item.pipeline] ?? ""}`}
                        >
                          {item.pipeline}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {item.agent ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_COLORS[item.status] ?? ""}`}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(item.started_at)}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {item.duration_sec != null
                          ? formatElapsed(item.duration_sec)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {item.status === "failed" && item.error
                          ? item.error
                          : item.result_summary ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {language === "ko" ? "이전" : "Prev"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {safePage} / {totalPages}{" "}
                  {language === "ko" ? "페이지" : "page"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {language === "ko" ? "다음" : "Next"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
