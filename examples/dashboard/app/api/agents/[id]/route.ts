import { NextRequest, NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import path from "path"

// Investment Alpha + Dev Team 에이전트 파일 매핑
const AGENT_FILES: Record<string, string> = {
  // Investment Alpha (.claude/agents/)
  "macro-economist": ".claude/agents/macro-economist.md",
  "commodity-analyst": ".claude/agents/commodity-analyst.md",
  "stock-analyst": ".claude/agents/stock-analyst.md",
  "real-estate-analyst": ".claude/agents/real-estate-analyst.md",
  "chief-analyst": ".claude/agents/chief-analyst.md",
  "monthly-reporter": ".claude/agents/monthly-reporter.md",
  // Dev Team (.claude/agents/)
  "solution-architect": ".claude/agents/solution-architect.md",
  "frontend-developer": ".claude/agents/frontend-developer.md",
  "qa-engineer": ".claude/agents/qa-engineer.md",
  "devops-engineer": ".claude/agents/devops-engineer.md",
  "ux-reviewer": ".claude/agents/ux-reviewer.md",
}

// MarketPulse 에이전트 (stock_pipeline.py 내 하드코딩, inline 타입 — 읽기 전용)
const INLINE_AGENTS = new Set([
  "technical-analyst",
  "supply-demand-analyst",
  "financial-analyst",
  "industry-analyst",
  "news-analyst",
  "market-analyst",
  "investment-strategist",
])

/** 프로젝트 루트 디렉토리 탐색 */
function findProjectRoot(): string {
  if (process.env.WORK_DIR) return process.env.WORK_DIR

  const candidates = [
    path.resolve(process.cwd(), "../../"),               // cwd = examples/dashboard
    path.resolve(process.cwd(), "../../../"),             // cwd = examples/dashboard/.next
    path.resolve(__dirname, "../../../../../../"),        // __dirname = .next/server/...
    path.resolve(__dirname, "../../../../../../../"),
    "/home/ec2-user/mimi",                               // EC2 절대경로 fallback
  ]

  for (const p of candidates) {
    // .claude/agents 디렉토리가 있는 곳이 프로젝트 루트
    if (existsSync(path.join(p, ".claude", "agents"))) return p
  }
  return candidates[0]
}

const PROJECT_ROOT = findProjectRoot()

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // inline 에이전트: 읽기 전용이지만 GET은 허용 (내용 없음 안내)
  if (INLINE_AGENTS.has(id)) {
    return NextResponse.json({
      content: `[inline agent] ${id}\n\nMarketPulse 파이프라인(stock_pipeline.py) 내 하드코딩된 에이전트입니다.\n프롬프트는 소스 코드에서 직접 관리됩니다.`,
      path: `(inline) pipeline/stock_pipeline.py`,
    })
  }

  const relPath = AGENT_FILES[id]
  if (!relPath) {
    return NextResponse.json(
      { error: `Unknown agent: ${id}` },
      { status: 404 }
    )
  }

  const filePath = path.join(PROJECT_ROOT, relPath)

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: `Agent file not found: ${relPath}` },
      { status: 404 }
    )
  }

  try {
    const content = readFileSync(filePath, "utf-8")
    return NextResponse.json({ content, path: relPath })
  } catch (err) {
    console.error(`[agents] Failed to read ${id}:`, (err as Error).message)
    return NextResponse.json(
      { error: "Failed to read agent file" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // inline 에이전트: 수정 불가
  if (INLINE_AGENTS.has(id)) {
    return NextResponse.json(
      { error: `Inline agent "${id}" is read-only. Edit the source code directly.` },
      { status: 501 }
    )
  }

  const relPath = AGENT_FILES[id]
  if (!relPath) {
    return NextResponse.json(
      { error: `Unknown agent: ${id}` },
      { status: 404 }
    )
  }

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Missing required field: content (string)" },
      { status: 400 }
    )
  }

  // 콘텐츠 크기 제한 (100KB)
  if (body.content.length > 100_000) {
    return NextResponse.json(
      { error: "Content too large (max 100KB)" },
      { status: 400 }
    )
  }

  const filePath = path.join(PROJECT_ROOT, relPath)

  try {
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(filePath, body.content, "utf-8")
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[agents] Failed to write ${id}:`, (err as Error).message)
    return NextResponse.json(
      { error: "Failed to write agent file" },
      { status: 500 }
    )
  }
}
