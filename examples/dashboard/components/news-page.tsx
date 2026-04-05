"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Newspaper, TrendingUp, Clock, Filter, X } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

interface Keyword {
  word: string
  count: number
  category: "섹터" | "이슈" | "종목" | "경제"
  sentiment: "긍정" | "부정" | "중립"
  related: string[]
}

interface Headline {
  title: string
  source: string
  time: string
  sentiment: "긍정" | "부정" | "중립"
  keywords: string[]
  url?: string
  region?: string
  type?: "news" | "youtube"
}

interface NewsData {
  generated_at: string
  keywords: Keyword[]
  headlines: Headline[]
}

const getSentimentColor = (sentiment: string) => {
  if (sentiment === "긍정") return "bg-green-500/20 border-green-500/50 text-green-400"
  if (sentiment === "부정") return "bg-red-500/20 border-red-500/50 text-red-400"
  return "bg-blue-500/20 border-blue-500/50 text-blue-400"
}

const getSentimentDot = (sentiment: string) => {
  if (sentiment === "긍정") return "bg-green-500"
  if (sentiment === "부정") return "bg-red-500"
  return "bg-blue-500"
}

const getCategoryBadge = (category: string) => {
  switch (category) {
    case "섹터": return "bg-purple-500/20 text-purple-400 border-purple-500/30"
    case "이슈": return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    case "종목": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
    case "경제": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }
}

const CATEGORY_EN: Record<string, string> = {
  "섹터": "Sector",
  "이슈": "Issue",
  "종목": "Stock",
  "경제": "Economy",
}

const SENTIMENT_EN: Record<string, string> = {
  "긍정": "Positive",
  "부정": "Negative",
  "중립": "Neutral",
}

const NEWS_SOURCES = [
  { name: "매일경제", url: "mk.co.kr", color: "#3b82f6" },
  { name: "한국경제", url: "hankyung.com", color: "#22c55e" },
  { name: "한경글로벌", url: "hankyung.com/globalmarket", color: "#14b8a6" },
  { name: "연합뉴스", url: "yna.co.kr", color: "#f59e0b" },
  { name: "조선비즈", url: "biz.chosun.com", color: "#ef4444" },
  { name: "Investing.com", url: "investing.com", color: "#8b5cf6" },
  { name: "슈카월드", url: "youtube.com/슈카", color: "#dc2626" },
  { name: "삼프로TV", url: "youtube.com/삼프로", color: "#dc2626" },
  { name: "올랜도캠퍼스", url: "youtube.com/올랜도", color: "#dc2626" },
]

function ScanAnimation({ isScanning, scanPhase, scanSource }: { isScanning: boolean; scanPhase: string; scanSource: string }) {
  if (!isScanning) return null
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-primary animate-ping absolute" />
            <div className="w-4 h-4 rounded-full bg-primary relative" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary animate-pulse">
            AI {scanPhase}
          </p>
          <p className="text-xs text-muted-foreground">{scanSource}</p>
        </div>
      </div>
      {/* 소스 스캔 바 */}
      <div className="space-y-1.5">
        {NEWS_SOURCES.map((src, i) => (
          <div key={src.name} className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-muted-foreground truncate">{src.name}</div>
            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: scanSource === src.name ? '100%' : scanSource > src.name ? '100%' : '0%',
                  backgroundColor: src.color,
                  opacity: scanSource === src.name ? 1 : scanSource > src.name ? 0.3 : 0.1,
                }}
              />
            </div>
            <div className="w-4">
              {scanSource > src.name && <span className="text-[10px] text-green-400">✓</span>}
              {scanSource === src.name && <span className="text-[10px] text-primary animate-pulse">●</span>}
            </div>
          </div>
        ))}
      </div>
      {/* 키워드 추출 텍스트 애니메이션 */}
      <div className="mt-3 p-2 rounded-lg bg-muted/20 border border-border/20">
        <p className="text-[10px] font-mono text-primary/70 animate-pulse truncate">
          {scanPhase === "뉴스 크롤링 중..." && `> fetching ${scanSource} RSS feed...`}
          {scanPhase === "키워드 분석 중..." && `> extracting keywords from ${scanSource}...`}
          {scanPhase === "감정 분석 중..." && `> analyzing sentiment: positive/negative/neutral...`}
          {scanPhase === "매핑 중..." && `> mapping keywords to headlines...`}
          {scanPhase === "완료!" && `> ✅ analysis complete. updating dashboard...`}
        </p>
      </div>
    </div>
  )
}

export function NewsPage() {
  const { language } = useLanguage()
  const [data, setData] = useState<NewsData | null>(null)
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [hoveredKeyword, setHoveredKeyword] = useState<Keyword | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanPhase, setScanPhase] = useState("")
  const [scanSource, setScanSource] = useState("")
  const [lastUpdate, setLastUpdate] = useState("")

  // 뉴스 로드 + 5분마다 자동 갱신 (스캔 애니메이션 포함)
  const loadNews = async (showAnimation = false) => {
    if (showAnimation) {
      setIsScanning(true)
      // 스캔 애니메이션 시퀀스
      for (const src of NEWS_SOURCES) {
        setScanPhase("뉴스 크롤링 중...")
        setScanSource(src.name)
        await new Promise(r => setTimeout(r, 200))
      }
      setScanPhase("키워드 분석 중...")
      setScanSource("Claude AI")
      await new Promise(r => setTimeout(r, 500))
      setScanPhase("감정 분석 중...")
      await new Promise(r => setTimeout(r, 400))
      setScanPhase("매핑 중...")
      await new Promise(r => setTimeout(r, 300))
    }

    try {
      const res = await fetch("/news_data.json?t=" + Date.now())
      const newData = await res.json()
      setData(newData)
      setLastUpdate(new Date().toLocaleTimeString())
      if (showAnimation) {
        setScanPhase("완료!")
        await new Promise(r => setTimeout(r, 800))
      }
    } catch {}

    setIsScanning(false)
  }

  useEffect(() => {
    loadNews(true) // 첫 로드 시 애니메이션
    const interval = setInterval(() => loadNews(true), 5 * 60 * 1000) // 5분마다 스캔 애니메이션
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "ko" ? "뉴스 데이터 로딩 중..." : "Loading news data..."}
          </p>
        </div>
      </div>
    )
  }

  const maxCount = data.keywords.length > 0 ? Math.max(...data.keywords.map(k => k.count)) : 1
  const getSize = (count: number) => 40 + (count / maxCount) * 120

  const filteredKeywords = (filterCategory
    ? data.keywords.filter(k => k.category === filterCategory)
    : data.keywords
  ).sort((a, b) => b.count - a.count)

  const filteredHeadlines = selectedKeyword
    ? data.headlines.filter(h => h.keywords.includes(selectedKeyword))
    : data.headlines

  const categories = [...new Set(data.keywords.map(k => k.category))]

  const sentimentSummary = {
    positive: data.keywords.filter(k => k.sentiment === "긍정").length,
    negative: data.keywords.filter(k => k.sentiment === "부정").length,
    neutral: data.keywords.filter(k => k.sentiment === "중립").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-bold text-foreground">
              {language === "ko" ? "실시간 뉴스 키워드" : "Live News Keywords"}
            </h2>
          </div>
          <div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {language === "ko" ? "수집" : "Crawled"}: {(data.generated_at ?? "").replace("T", " ").substring(0, 19)}
              </span>
              {lastUpdate && (
                <span className="flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  {language === "ko" ? "갱신" : "Updated"}: {lastUpdate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-400">
              {language === "ko" ? "긍정" : "Positive"} {sentimentSummary.positive}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-400">
              {language === "ko" ? "부정" : "Negative"} {sentimentSummary.negative}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-blue-400">
              {language === "ko" ? "중립" : "Neutral"} {sentimentSummary.neutral}
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            !filterCategory
              ? "bg-white/10 text-foreground border border-white/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {language === "ko" ? "전체" : "All"}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filterCategory === cat
                ? getCategoryBadge(cat)
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {language === "ko" ? cat : CATEGORY_EN[cat] || cat}
          </button>
        ))}
      </div>

      {/* Selected Keyword Info */}
      {selectedKeyword && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {language === "ko" ? "필터:" : "Filter:"}
          </span>
          <Badge variant="secondary" className="flex items-center gap-1">
            {selectedKeyword}
            <button onClick={() => setSelectedKeyword(null)}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">
            ({filteredHeadlines.length}{language === "ko" ? "건" : " results"})
          </span>
        </div>
      )}

      {/* Word Cloud + Headlines: 2-column on desktop, stacked on mobile */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left: Word Cloud */}
        <Card className="border-border/50 bg-card/50 backdrop-blur overflow-hidden flex-1">
          <CardContent className="p-6">
            <div className="relative min-h-[350px] p-6 rounded-2xl bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-border/20">
              {/* 배경 그리드 애니메이션 */}
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />

              {/* 워드클라우드 */}
              <div className="relative flex flex-wrap gap-x-3 gap-y-2 justify-center items-center">
                {filteredKeywords.map((kw, idx) => {
                  const fontSize = Math.max(12, 14 + (kw.count / maxCount) * 36)
                  const isSelected = selectedKeyword === kw.word
                  const isHovered = hoveredKeyword?.word === kw.word
                  const sentColor = kw.sentiment === "긍정" ? "text-green-400" : kw.sentiment === "부정" ? "text-red-400" : "text-blue-300"
                  const glowColor = kw.sentiment === "긍정" ? "drop-shadow(0 0 8px rgba(74,222,128,0.4))" : kw.sentiment === "부정" ? "drop-shadow(0 0 8px rgba(248,113,113,0.4))" : "drop-shadow(0 0 6px rgba(147,197,253,0.3))"

                  return (
                    <div
                      key={kw.word}
                      className="relative group"
                      onMouseEnter={() => setHoveredKeyword(kw)}
                      onMouseLeave={() => setHoveredKeyword(null)}
                    >
                      <button
                        onClick={() => setSelectedKeyword(isSelected ? null : kw.word)}
                        className={`
                          font-bold transition-all duration-500 cursor-pointer
                          hover:scale-110 whitespace-nowrap
                          ${sentColor}
                          ${isSelected ? "scale-110 underline underline-offset-4" : ""}
                        `}
                        style={{
                          fontSize: `${fontSize}px`,
                          filter: isHovered ? glowColor : 'none',
                          opacity: selectedKeyword && !isSelected ? 0.3 : 1,
                          animationName: 'wordFadeIn',
                          animationDuration: `${0.3 + idx * 0.05}s`,
                          animationFillMode: 'backwards',
                          animationTimingFunction: 'ease-out',
                        }}
                      >
                        {kw.word}
                        <sup className="text-[9px] ml-0.5 opacity-60 font-normal">{kw.count}</sup>
                      </button>

                      {/* Hover Tooltip */}
                      {isHovered && (
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                          <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-sm">{kw.word}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${getCategoryBadge(kw.category)}`}>
                                {language === "ko" ? kw.category : CATEGORY_EN[kw.category]}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {language === "ko" ? "빈도" : "Freq"}: <b>{kw.count}</b>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${getSentimentDot(kw.sentiment)}`} />
                                <span className="text-xs text-muted-foreground">
                                  {language === "ko" ? kw.sentiment : SENTIMENT_EN[kw.sentiment]}
                                </span>
                              </div>
                            </div>
                            {kw.related.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {kw.related.map(r => (
                                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* CSS Animation */}
              <style>{`
                @keyframes wordFadeIn {
                  from { opacity: 0; transform: translateY(12px) scale(0.8); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
              `}</style>
            </div>
          </CardContent>
        </Card>

        {/* Right: Headlines List */}
        <Card className="border-border/50 bg-card/50 backdrop-blur w-full md:w-[400px] md:shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Newspaper className="w-5 h-5" />
              {language === "ko" ? "주요 헤드라인" : "Top Headlines"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredHeadlines.map((hl, idx) => {
                // Relative time calculation
                const relativeTime = (() => {
                  try {
                    const now = new Date()
                    const hlDate = new Date(hl.time)
                    if (isNaN(hlDate.getTime())) return hl.time
                    const diffMs = now.getTime() - hlDate.getTime()
                    if (diffMs < 0) return hl.time
                    const diffMin = Math.floor(diffMs / 60000)
                    const diffHour = Math.floor(diffMs / 3600000)
                    const diffDay = Math.floor(diffMs / 86400000)
                    if (diffMin < 1) return language === "ko" ? "방금 전" : "just now"
                    if (diffMin < 60) return language === "ko" ? `${diffMin}분 전` : `${diffMin}m ago`
                    if (diffHour < 24) return language === "ko" ? `${diffHour}시간 전` : `${diffHour}h ago`
                    if (diffDay < 7) return language === "ko" ? `${diffDay}일 전` : `${diffDay}d ago`
                    return hl.time
                  } catch {
                    return hl.time
                  }
                })()

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50 cursor-pointer group"
                    onClick={() => hl.url && window.open(hl.url, '_blank')}
                  >
                    {hl.type === "youtube" ? (
                      <svg className="w-5 h-4 mt-1 shrink-0" viewBox="0 0 24 18" fill="none">
                        <rect width="24" height="18" rx="4" fill="#FF0000"/>
                        <path d="M9.5 13V5L16 9L9.5 13Z" fill="white"/>
                      </svg>
                    ) : (
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${getSentimentDot(hl.sentiment)}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                        {hl.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{hl.source}</span>
                        <span className="text-xs text-muted-foreground/50">|</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {relativeTime}
                        </span>
                        <span className="text-xs text-muted-foreground/50">|</span>
                        {hl.keywords.map(kw => (
                          <button
                            key={kw}
                            onClick={(e) => { e.stopPropagation(); setSelectedKeyword(selectedKeyword === kw ? null : kw) }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            #{kw}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        hl.sentiment === "긍정"
                          ? "border-green-500/30 text-green-400"
                          : hl.sentiment === "부정"
                          ? "border-red-500/30 text-red-400"
                          : "border-blue-500/30 text-blue-400"
                      }`}
                    >
                      {language === "ko" ? hl.sentiment : SENTIMENT_EN[hl.sentiment]}
                    </Badge>
                  </div>
                )
              })}
              {filteredHeadlines.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {language === "ko"
                    ? "선택한 키워드에 해당하는 뉴스가 없습니다."
                    : "No headlines match the selected keyword."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
