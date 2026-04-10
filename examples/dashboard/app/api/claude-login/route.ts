import { NextResponse } from "next/server"
import { exec, spawn } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execAsync = promisify(exec)

function getClaudeBin(): string {
  const candidates = [
    "/home/ec2-user/.local/bin/claude",
    `${process.env.HOME}/.local/bin/claude`,
    "/usr/local/bin/claude",
    "claude",
  ]
  for (const p of candidates) {
    if (p !== "claude" && fs.existsSync(p)) return p
  }
  return "claude"
}

// 진행중인 로그인 프로세스 저장 (서버 메모리, 재시작 시 초기화)
let loginProcess: ReturnType<typeof spawn> | null = null
let loginUrl: string | null = null
let loginStatus: "idle" | "pending" | "error" = "idle"

// GET: 현재 Claude CLI 상태 조회
export async function GET() {
  const claude = getClaudeBin()

  // claude binary 존재 확인
  if (!fs.existsSync(claude) && claude !== "claude") {
    return NextResponse.json({
      installed: false,
      logged_in: false,
      message: "Claude CLI가 설치되지 않았습니다",
      bin_path: claude,
    })
  }

  try {
    // claude auth status --json
    const { stdout, stderr } = await execAsync(`${claude} auth status 2>&1 || true`, { timeout: 10000 })
    const output = (stdout + stderr).trim()

    // JSON 파싱 시도
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const statusJson = JSON.parse(jsonMatch[0])
        const loggedIn = statusJson.loggedIn === true
        return NextResponse.json({
          installed: true,
          logged_in: loggedIn,
          auth_method: statusJson.authMethod || "none",
          provider: statusJson.apiProvider || "unknown",
          login_pending: loginStatus === "pending",
          login_url: loginStatus === "pending" ? loginUrl : null,
          bin_path: claude,
        })
      }
    } catch {}

    // 텍스트에서 상태 추론
    const loggedIn = output.includes("Logged in") || output.includes("loggedIn: true")
    return NextResponse.json({
      installed: true,
      logged_in: loggedIn,
      login_pending: loginStatus === "pending",
      login_url: loginStatus === "pending" ? loginUrl : null,
      raw_output: output.slice(0, 200),
      bin_path: claude,
    })
  } catch (e: any) {
    return NextResponse.json({
      installed: true,
      logged_in: false,
      error: e.message,
      login_pending: loginStatus === "pending",
      login_url: loginStatus === "pending" ? loginUrl : null,
      bin_path: claude,
    })
  }
}

// POST: 로그인/로그아웃/테스트 액션
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { action } = body
  const claude = getClaudeBin()

  if (action === "start-login") {
    // 이미 진행중이면 현재 URL 반환
    if (loginStatus === "pending" && loginUrl) {
      return NextResponse.json({ success: true, url: loginUrl, status: "pending" })
    }

    // 기존 프로세스 정리
    if (loginProcess) {
      try { loginProcess.kill() } catch {}
      loginProcess = null
    }

    loginUrl = null
    loginStatus = "pending"

    return new Promise<NextResponse>((resolve) => {
      let resolved = false

      const proc = spawn(claude, ["auth", "login"], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      })
      loginProcess = proc

      let buffer = ""
      const urlRegex = /https:\/\/[^\s]+oauth[^\s]+/i

      const handleData = (data: Buffer) => {
        buffer += data.toString()
        const match = buffer.match(urlRegex)
        if (match && !resolved) {
          resolved = true
          loginUrl = match[0]
          resolve(NextResponse.json({ success: true, url: loginUrl, status: "pending" }))
        }
      }

      proc.stdout?.on("data", handleData)
      proc.stderr?.on("data", handleData)

      proc.on("exit", (code) => {
        loginProcess = null
        if (code === 0) {
          loginStatus = "idle"
          loginUrl = null
        } else {
          loginStatus = "error"
        }
      })

      proc.on("error", (err) => {
        loginStatus = "error"
        if (!resolved) {
          resolved = true
          resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }))
        }
      })

      // 10초 내에 URL이 안 나오면 오류
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          loginStatus = "error"
          resolve(NextResponse.json({
            success: false,
            error: "로그인 URL을 가져오지 못했습니다 (10초 타임아웃)",
            raw: buffer.slice(0, 500),
          }, { status: 500 }))
        }
      }, 10000)
    })
  }

  if (action === "cancel-login") {
    if (loginProcess) {
      try { loginProcess.kill() } catch {}
      loginProcess = null
    }
    loginUrl = null
    loginStatus = "idle"
    return NextResponse.json({ success: true })
  }

  if (action === "logout") {
    try {
      const { stdout, stderr } = await execAsync(`${claude} auth logout 2>&1`, { timeout: 10000 })
      return NextResponse.json({ success: true, output: (stdout + stderr).trim() })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
  }

  if (action === "test") {
    try {
      const { stdout, stderr } = await execAsync(
        `${claude} -p "respond with exactly: CLAUDE_OK" --output-format text 2>&1`,
        { timeout: 30000 }
      )
      const output = (stdout + stderr).trim()
      const ok = output.includes("CLAUDE_OK")
      return NextResponse.json({ success: ok, output: output.slice(0, 200) })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
