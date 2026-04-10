import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execAsync = promisify(exec)

function getWorkDir(): string {
  if (process.env.WORK_DIR) return process.env.WORK_DIR
  const cwd = process.cwd()
  // examples/dashboard에서 실행 시 상위 2단계
  const rel = path.resolve(cwd, "../..")
  if (fs.existsSync(path.join(rel, "trading"))) return rel
  // EC2 fallback
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

  const workDir = getWorkDir()
  const pythonBin = process.env.PYTHON_BIN || "python3"
  const script = path.join(workDir, "scripts", "sync_portfolio.py")

  if (!fs.existsSync(script)) {
    return NextResponse.json({ error: "sync_portfolio.py not found" }, { status: 500 })
  }

  const modeArg = mode ? `--mode ${mode}` : ""
  const cmd = `cd "${workDir}" && ${pythonBin} scripts/sync_portfolio.py ${modeArg}`

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 })
    if (stderr) console.error("[portfolio sync]", stderr)

    // 동기화 후 최신 데이터 반환
    const jsonPath = getPortfolioJson()
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8")
      return NextResponse.json({ success: true, data: JSON.parse(raw) })
    }
    return NextResponse.json({ success: true, data: null })
  } catch (e: any) {
    console.error("[portfolio sync error]", e.message)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
