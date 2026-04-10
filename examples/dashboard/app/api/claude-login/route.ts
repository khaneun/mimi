import { NextResponse } from "next/server"
import { exec, spawn } from "child_process"
import { promisify } from "util"
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

let loginProcess: ReturnType<typeof spawn> | null = null
let loginUrl: string | null = null
let loginStatus: "idle" | "pending" | "error" = "idle"

// GET: 현재 Claude CLI 상태 조회
export async function GET() {
  const claude = getClaudeBin()

  if (!fs.existsSync(claude) && claude !== "claude") {
    return NextResponse.json({
      installed: false,
      logged_in: false,
      message: "Claude CLI가 설치되지 않았습니다",
    })
  }

  try {
    const { stdout, stderr } = await execAsync(`${claude} auth status 2>&1 || true`, { timeout: 10000 })
    const output = (stdout + stderr).trim()

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
        })
      }
    } catch {}

    const loggedIn = output.includes("Logged in") || output.includes("loggedIn: true")
    return NextResponse.json({
      installed: true,
      logged_in: loggedIn,
      login_pending: loginStatus === "pending",
      login_url: loginStatus === "pending" ? loginUrl : null,
    })
  } catch (e: any) {
    console.error("[claude-login] status check error:", e.message)
    return NextResponse.json({
      installed: true,
      logged_in: false,
      login_pending: loginStatus === "pending",
      login_url: loginStatus === "pending" ? loginUrl : null,
    })
  }
}

// POST: 로그인/로그아웃/테스트 액션
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { action } = body
  const claude = getClaudeBin()

  // 액션 화이트리스트 검증
  const ALLOWED_ACTIONS = new Set(["start-login", "cancel-login", "logout", "test"])
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  if (action === "start-login") {
    if (loginStatus === "pending" && loginUrl) {
      return NextResponse.json({ success: true, url: loginUrl, status: "pending" })
    }

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
        loginStatus = code === 0 ? "idle" : "error"
        if (code === 0) loginUrl = null
      })

      proc.on("error", (err) => {
        loginStatus = "error"
        console.error("[claude-login] spawn error:", err.message)
        if (!resolved) {
          resolved = true
          resolve(NextResponse.json({ success: false, error: "Login process failed" }, { status: 500 }))
        }
      })

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          loginStatus = "error"
          resolve(NextResponse.json({
            success: false,
            error: "로그인 URL을 가져오지 못했습니다 (10초 타임아웃)",
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
      await execAsync(`${claude} auth logout 2>&1`, { timeout: 10000 })
      return NextResponse.json({ success: true })
    } catch (e: any) {
      console.error("[claude-login] logout error:", e.message)
      return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 })
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
      return NextResponse.json({ success: ok })
    } catch (e: any) {
      console.error("[claude-login] test error:", e.message)
      return NextResponse.json({ success: false, error: "Test failed" })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
