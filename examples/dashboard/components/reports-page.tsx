"use client"

import { useState, Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  ExternalLink, FileText, ChevronDown, ChevronUp, X,
  Landmark, Gem, CandlestickChart, MapPin, Crown, Clock,
  Activity, Users, Fuel, Swords, Brain, Wallet, CalendarDays,
} from "lucide-react"

type Category = "전체" | "매크로" | "특별" | "종목" | "월별"

interface Report {
  name: string
  file: string
  category: Category
  icon: any
  color: string
  desc: string
  date: string
}

const CATEGORY_BADGE: Record<Exclude<Category, "전체">, string> = {
  "매크로": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "특별": "bg-red-500/15 text-red-400 border-red-500/30",
  "종목": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "월별": "bg-teal-500/15 text-teal-400 border-teal-500/30",
}

const ALL_REPORTS: Report[] = [
  // 매크로 (6개)
  { name: "거시경제 분석", file: "macro/macro_economy_report.html", category: "매크로", icon: Landmark, color: "text-sky-400", desc: "금리, GDP, 인플레이션, 환율", date: "2026-04-04" },
  { name: "원자재 분석", file: "macro/commodity_report.html", category: "매크로", icon: Gem, color: "text-amber-400", desc: "금, 은, 원유, 구리", date: "2026-04-04" },
  { name: "주식시장 분석", file: "macro/stock_market_report.html", category: "매크로", icon: CandlestickChart, color: "text-rose-400", desc: "S&P500, KOSPI, 종목 추천", date: "2026-04-04" },
  { name: "부동산 분석", file: "macro/real_estate_report.html", category: "매크로", icon: MapPin, color: "text-emerald-400", desc: "서울 권역별, REITs", date: "2026-04-04" },
  { name: "종합 투자 분석", file: "macro/final_investment_report.html", category: "매크로", icon: Crown, color: "text-violet-400", desc: "4개 분야 종합, 포트폴리오 전략", date: "2026-04-04" },
  { name: "매수 타이밍 전략", file: "macro/timing_strategy_report.html", category: "매크로", icon: Clock, color: "text-orange-400", desc: "이벤트 캘린더, 분할매수", date: "2026-04-04" },
  // 특별 (4개)
  { name: "코스피 종합 분석", file: "special/kospi_market_analysis_report.html", category: "특별", icon: Activity, color: "text-indigo-400", desc: "외국인/기관, 섹터, 환율", date: "2026-04-04" },
  { name: "외국인 매도 분석", file: "special/foreign_selling_analysis_report.html", category: "특별", icon: Users, color: "text-pink-400", desc: "매도 타임라인, 복귀 시그널", date: "2026-04-04" },
  { name: "유가 급등 영향", file: "special/oil_surge_impact_report.html", category: "특별", icon: Fuel, color: "text-amber-500", desc: "시나리오별 대응 전략", date: "2026-04-04" },
  { name: "전쟁 비교 분석", file: "special/war_historical_comparison_report.html", category: "특별", icon: Swords, color: "text-red-400", desc: "1973/1990/2003 vs 2026", date: "2026-04-04" },
  // 종목 (3개)
  { name: "SK하이닉스 (000660)", file: "stocks/000660_SK하이닉스_20260404.html", category: "종목", icon: Brain, color: "text-emerald-400", desc: "5개 에이전트 병렬 분석", date: "2026-04-04" },
  { name: "삼성전자 (005930)", file: "stocks/005930_삼성전자_20260404.html", category: "종목", icon: Brain, color: "text-emerald-400", desc: "5개 에이전트 병렬 분석", date: "2026-04-04" },
  { name: "네이버 (035420)", file: "stocks/035420_네이버_20260404.html", category: "종목", icon: Brain, color: "text-emerald-400", desc: "5개 에이전트 병렬 분석", date: "2026-04-04" },
  // 월별 (2개)
  { name: "2026년 3월 월별 종합", file: "macro/monthly_report_2026-03.html", category: "월별", icon: CalendarDays, color: "text-teal-400", desc: "매매 실적 + 시장 분석", date: "2026-04-04" },
  { name: "포트폴리오 종합 분석", file: "macro/portfolio_analysis_report.html", category: "월별", icon: Wallet, color: "text-cyan-400", desc: "15종목 수익률, 리밸런싱", date: "2026-04-04" },
]

const CATEGORIES: Category[] = ["전체", "매크로", "특별", "종목", "월별"]

function countByCategory(cat: Exclude<Category, "전체">) {
  return ALL_REPORTS.filter((r) => r.category === cat).length
}

export function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("전체")
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  const filtered = activeCategory === "전체"
    ? ALL_REPORTS
    : ALL_REPORTS.filter((r) => r.category === activeCategory)

  const getReportUrl = (file: string) => `/reports/${file}`

  const toggleExpand = (file: string) => {
    setExpandedReport((prev) => (prev === file ? null : file))
  }

  return (
    <div className="space-y-4">
      {/* 섹션 1: 컴팩트 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-foreground">리포트</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>전체 <strong className="text-foreground">{ALL_REPORTS.length}</strong></span>
          <span className="text-border">|</span>
          <span>매크로 <strong className="text-blue-400">{countByCategory("매크로")}</strong></span>
          <span className="text-border">|</span>
          <span>특별 <strong className="text-red-400">{countByCategory("특별")}</strong></span>
          <span className="text-border">|</span>
          <span>종목 <strong className="text-emerald-400">{countByCategory("종목")}</strong></span>
          <span className="text-border">|</span>
          <span>월별 <strong className="text-teal-400">{countByCategory("월별")}</strong></span>
        </div>
      </div>

      {/* 섹션 2: 카테고리 탭 필터 */}
      <div className="flex gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setExpandedReport(null) }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {cat === "전체" ? "전체" : cat === "특별" ? "특별 분석" : cat === "종목" ? "종목 분석" : cat}
          </button>
        ))}
      </div>

      {/* 섹션 3: 리포트 테이블 */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[300px]">리포트명</TableHead>
              <TableHead className="w-[80px]">카테고리</TableHead>
              <TableHead className="w-[100px]">생성일</TableHead>
              <TableHead>요약</TableHead>
              <TableHead className="w-[70px] text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((report) => {
              const Icon = report.icon
              const isExpanded = expandedReport === report.file
              const url = getReportUrl(report.file)
              const badgeClass = CATEGORY_BADGE[report.category as Exclude<Category, "전체">]

              return (
                <Fragment key={report.file}>
                  {/* 메인 행 */}
                  <TableRow
                    className="cursor-pointer group"
                    onClick={() => toggleExpand(report.file)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                        <Icon className={`w-4 h-4 ${report.color} shrink-0`} />
                        <span className="font-medium text-sm">{report.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${badgeClass}`}>
                        {report.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {report.date}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {report.desc}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(url, "_blank")
                        }}
                      >
                        열기
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* 아코디언 미리보기 */}
                  {isExpanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-3 bg-muted/10">
                          <div className="rounded-lg border border-border/50 overflow-hidden">
                            <iframe
                              src={url}
                              className="w-full border-0"
                              style={{ height: "400px" }}
                            />
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => window.open(url, "_blank")}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              새 탭에서 열기
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setExpandedReport(null)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              닫기
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
