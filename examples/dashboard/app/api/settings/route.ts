import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execAsync = promisify(exec)

function getWorkDir(): string {
  if (process.env.WORK_DIR) return process.env.WORK_DIR
  const cwd = process.cwd()
  const rel = path.resolve(cwd, "../..")
  if (fs.existsSync(path.join(rel, "trading"))) return rel
  const ec2 = "/home/ec2-user/mimi"
  if (fs.existsSync(ec2)) return ec2
  return cwd
}

// GET: 현재 설정값 반환
export async function GET() {
  const kisMode = process.env.KIS_MODE || "paper"
  const kisEnabled = process.env.KIS_ENABLED !== "false"

  return NextResponse.json({
    kis_mode: kisMode,
    kis_enabled: kisEnabled,
    available_modes: [
      { value: "paper", label: "모의투자", description: "가상 계좌로 연습 매매" },
      { value: "real", label: "실전투자", description: "실제 계좌 연동" },
    ],
  })
}

// POST: 설정 변경
export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { kis_mode } = body

  if (kis_mode && !["paper", "real"].includes(kis_mode)) {
    return NextResponse.json({ error: "Invalid KIS mode" }, { status: 400 })
  }

  // .env 파일의 KIS_MODE 업데이트
  const workDir = getWorkDir()
  const envPath = path.join(workDir, ".env")

  try {
    let envContent = ""
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8")
    }

    if (kis_mode) {
      if (envContent.includes("KIS_MODE=")) {
        envContent = envContent.replace(/KIS_MODE=\S*/gm, `KIS_MODE=${kis_mode}`)
      } else {
        envContent += `\nKIS_MODE=${kis_mode}\n`
      }
      fs.writeFileSync(envPath, envContent, "utf-8")
      process.env.KIS_MODE = kis_mode
    }

    return NextResponse.json({
      success: true,
      kis_mode: kis_mode || process.env.KIS_MODE || "paper",
    })
  } catch (e: any) {
    console.error("[settings] Failed to update:", e.message)
    return NextResponse.json({ success: false, error: "Settings update failed" }, { status: 500 })
  }
}
