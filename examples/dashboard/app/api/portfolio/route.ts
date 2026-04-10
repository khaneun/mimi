import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execFileAsync = promisify(execFile)

// 허용된 모드 화이트리스트
const ALLOWED_MODES = new Set(["paper", "real"])

function getWorkDir(): string {
  if (process.env.WORK_DIR) return process.env.WORK_DIR
  const cwd = process.cwd()
  const rel = path.resolve(cwd, "../..")
  if (fs.existsSync(path.join(rel, "trading"))) return rel
  const ec2 = "/home/ec2-user/mimi"
  if (fs.existsSync(ec2)) return ec2
  return cwd
}

function getPortfolioJson(): string {
  const workDir = getWorkDir()
  return path.join(workDir, "examples", "dashboard", "public", "portfolio_data.json")
}

// GET: 현재 portfolio_data.json 반환
export async function GET() {
  const jsonPath = getPortfolioJson()
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ accounts: [], synced_at: null, kis_mode: "paper" })
  }
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8")
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ accounts: [], synced_at: null, kis_mode: "paper" })
  }
}

// POST: KIS API에서 실시간 동기화
export async function POST(request: Request) {
  let mode: string | undefined
  try {
    const body = await request.json()
    mode = body?.mode
  } catch {}

  // 모드 화이트리스트 검증
  if (mode && !ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: "Invalid mode. Allowed: paper, real" }, { status: 400 })
  }

  const workDir = getWorkDir()

  function getPythonBin(): string {
    if (process.env.PYTHON_BIN) {
      const bin = process.env.PYTHON_BIN
      if (!/^[a-zA-Z0-9._/\-]+$/.test(bin)) return "python3"
      return bin
    }
    const venvPaths = [
      path.join(workDir, ".venv", "bin", "python3"),
      "/home/ec2-user/mimi/.venv/bin/python3",
    ]
    for (const p of venvPaths) {
      if (fs.existsSync(p)) return p
    }
    return "python3"
  }

  const pythonBin = getPythonBin()
  const script = path.join(workDir, "scripts", "sync_portfolio.py")

  if (!fs.existsSync(script)) {
    return NextResponse.json({ error: "sync script not found" }, { status: 500 })
  }

  // execFile (shell=false) — 커맨드 인젝션 방지
  const args = [script]
  if (mode) {
    args.push("--mode", mode)
  }

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, args, {
      timeout: 30000,
      cwd: workDir,
      env: { ...process.env, PYTHONPATH: workDir },
    })
    if (stderr) console.error("[portfolio sync]", stderr)

    const jsonPath = getPortfolioJson()
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8")
      return NextResponse.json({ success: true, data: JSON.parse(raw) })
    }
    return NextResponse.json({ success: true, data: null })
  } catch (e: any) {
    console.error("[portfolio sync error]", e.message)
    return NextResponse.json({ success: false, error: "Portfolio sync failed" }, { status: 500 })
  }
}
