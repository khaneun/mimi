import { NextRequest, NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import { spawn } from "child_process"
import path from "path"

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
    if (existsSync(path.join(p, "reports"))) return p
  }
  return candidates[0]
}

const PROJECT_ROOT = findProjectRoot()
const EXECUTION_LOG_PATH = path.join(
  PROJECT_ROOT,
  "reports",
  ".harness_state",
  "execution_log.json"
)

// 허용된 스크립트 화이트리스트 (보안)
const ALLOWED_SCRIPTS = new Set([
  "pipeline/daily_pipeline.py",
  "pipeline/macro_pipeline.py",
  "pipeline/stock_pipeline.py",
  "pipeline/news_crawler.py",
  "pipeline/news_analyzer.py",
  "pipeline/watchlist_analyzer.py",
  "pipeline/archive_pipeline.py",
  "pipeline/realtime_server.py",
])

function getPythonBin(): string {
  const venvPaths = [
    path.join(PROJECT_ROOT, ".venv", "bin", "python3"),
    "/home/ec2-user/mimi/.venv/bin/python3",
  ]
  for (const p of venvPaths) {
    if (existsSync(p)) return p
  }
  return "python3"
}

export async function POST(req: NextRequest) {
  let body: { script?: string }
  try { body = await req.json() } catch { body = {} }

  const { script } = body
  if (!script || !ALLOWED_SCRIPTS.has(script)) {
    return NextResponse.json({ error: `허용되지 않은 스크립트: ${script}` }, { status: 400 })
  }

  const scriptPath = path.join(PROJECT_ROOT, script)
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: `스크립트 없음: ${script}` }, { status: 404 })
  }

  const python = getPythonBin()

  try {
    // 백그라운드 실행 (nohup 대신 detached spawn)
    const child = spawn(python, [scriptPath], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
    })
    child.unref()
    return NextResponse.json({ success: true, message: "실행 시작" })
  } catch (e: any) {
    console.error("[execution] spawn error:", e.message)
    return NextResponse.json({ success: false, error: "Script execution failed" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  if (!existsSync(EXECUTION_LOG_PATH)) {
    return NextResponse.json({ items: [] })
  }

  try {
    const raw = readFileSync(EXECUTION_LOG_PATH, "utf-8")
    const data = JSON.parse(raw)

    // 배열이면 그대로, 아니면 빈 배열
    const items = Array.isArray(data) ? data : []
    return NextResponse.json({ items })
  } catch (err) {
    console.error("[execution] Failed to read log:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to read execution log" },
      { status: 500 }
    )
  }
}
