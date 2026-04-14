import { NextRequest, NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync } from "fs"
import { spawn, exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)

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
const HARNESS_STATE_DIR = path.join(PROJECT_ROOT, "reports", ".harness_state")
const LAST_RUN_PATH = path.join(HARNESS_STATE_DIR, "last_run.json")
const LOGS_DIR = path.join(HARNESS_STATE_DIR, "logs")

// 스크립트 경로 → ID 매핑
const SCRIPT_ID_MAP: Record<string, string> = {
  "pipeline/daily_pipeline.py":      "daily",
  "pipeline/macro_pipeline.py":      "macro",
  "pipeline/stock_pipeline.py":      "stock",
  "pipeline/news_crawler.py":        "news_crawler",
  "pipeline/news_analyzer.py":       "news_analyzer",
  "pipeline/watchlist_analyzer.py":  "watchlist",
  "pipeline/archive_pipeline.py":    "archive",
  "pipeline/realtime_server.py":     "realtime",
}

const ALLOWED_SCRIPTS = new Set(Object.keys(SCRIPT_ID_MAP))

function ensureDirs() {
  if (!existsSync(HARNESS_STATE_DIR)) mkdirSync(HARNESS_STATE_DIR, { recursive: true })
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true })
}

function getLastRunTimes(): Record<string, string> {
  if (!existsSync(LAST_RUN_PATH)) return {}
  try {
    return JSON.parse(readFileSync(LAST_RUN_PATH, "utf-8"))
  } catch {
    return {}
  }
}

function saveLastRunTime(scriptId: string, time: string) {
  ensureDirs()
  const times = getLastRunTimes()
  times[scriptId] = time
  writeFileSync(LAST_RUN_PATH, JSON.stringify(times, null, 2))
}

/** pgrep으로 현재 실행 중인 스크립트 ID 목록 반환 */
async function getRunningScriptIds(): Promise<string[]> {
  const running: string[] = []
  await Promise.all(
    Object.entries(SCRIPT_ID_MAP).map(async ([scriptPath, scriptId]) => {
      const scriptName = path.basename(scriptPath)
      try {
        const { stdout } = await execAsync(`pgrep -f "${scriptName}"`)
        if (stdout.trim()) running.push(scriptId)
      } catch {
        // 프로세스 없음 (pgrep exit 1)
      }
    })
  )
  return running
}

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const logId = searchParams.get("log")

  // 로그 파일 조회
  if (logId) {
    ensureDirs()
    const logFile = path.join(LOGS_DIR, `${logId}.log`)
    if (!existsSync(logFile)) {
      return NextResponse.json({ log: "" })
    }
    try {
      const content = readFileSync(logFile, "utf-8")
      // 마지막 4000자만 반환 (최신 로그 우선)
      return NextResponse.json({ log: content.length > 4000 ? content.slice(-4000) : content })
    } catch {
      return NextResponse.json({ log: "" })
    }
  }

  // 상태 조회: lastRunTimes + 실행 중인 프로세스 목록
  const [lastRunTimes, running] = await Promise.all([
    Promise.resolve(getLastRunTimes()),
    getRunningScriptIds(),
  ])

  return NextResponse.json({ lastRunTimes, running })
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
  const scriptId = SCRIPT_ID_MAP[script]
  const now = new Date().toISOString().replace("T", " ").substring(0, 19)

  ensureDirs()

  // 마지막 실행 시간 저장 (재기동 후에도 유지)
  saveLastRunTime(scriptId, now)

  // 로그 파일에 stdout/stderr 리다이렉트 (파일 디스크립터 방식 — detached 호환)
  const logFile = path.join(LOGS_DIR, `${scriptId}.log`)
  const logFd = openSync(logFile, "a")

  try {
    // 헤더 라인 (동기 write)
    const header = `\n=== 실행 시작: ${now} ===\n`
    const { writeSync } = await import("fs")
    writeSync(logFd, header)
  } catch { /* ignore */ }

  try {
    const child = spawn(python, [scriptPath], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
    })
    child.unref()
    closeSync(logFd)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    closeSync(logFd)
    console.error("[execution] spawn error:", e.message)
    return NextResponse.json({ success: false, error: "Script execution failed" }, { status: 500 })
  }
}
