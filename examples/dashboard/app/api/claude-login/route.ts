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

// 모듈 레벨 상태 (Next.js 서버 프로세스 생존 동안 유지)
let loginProcess: ReturnType<typeof spawn> | null = null
let loginUrl: string | null = null
let loginStatus: "idle" | "awaiting_code" | "error" = "idle"

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
          login_status: loginStatus,
          login_url: loginStatus === "awaiting_code" ? loginUrl : null,
        })
      }
    } catch {}

    const loggedIn = output.includes("Logged in") || output.includes("loggedIn: true")
    return NextResponse.json({
      installed: true,
      logged_in: loggedIn,
      login_status: loginStatus,
      login_url: loginStatus === "awaiting_code" ? loginUrl : null,
    })
  } catch (e: any) {
    return NextResponse.json({
      installed: true,
      logged_in: false,
      login_status: loginStatus,
      login_url: loginStatus === "awaiting_code" ? loginUrl : null,
    })
  }
}

// POST: 로그인/코드제출/취소/로그아웃/테스트
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { action } = body
  const claude = getClaudeBin()

  const ALLOWED_ACTIONS = new Set(["start-login", "submit-code", "cancel-login", "logout", "test"])
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  // ── 1단계: 로그인 프로세스 시작, URL 획득 ──
  if (action === "start-login") {
    // 이미 대기 중이면 기존 URL 반환
    if (loginStatus === "awaiting_code" && loginUrl) {
      return NextResponse.json({ success: true, url: loginUrl, status: "awaiting_code" })
    }

    // 기존 프로세스 정리
    if (loginProcess) {
      try { loginProcess.kill() } catch {}
      loginProcess = null
    }
    loginUrl = null
    loginStatus = "idle"

    return new Promise<NextResponse>((resolve) => {
      let resolved = false

      const proc = spawn(claude, ["auth", "login"], {
        // stdin pipe: 2단계에서 코드를 stdin으로 전송
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      })
      loginProcess = proc

      let buffer = ""
      // claude auth login이 출력하는 URL 패턴
      const urlRegex = /(https:\/\/[^\s\r\n]+)/i

      const handleData = (data: Buffer) => {
        buffer += data.toString()
        const match = buffer.match(urlRegex)
        if (match && !resolved) {
          resolved = true
          loginUrl = match[1]
          loginStatus = "awaiting_code"
          resolve(NextResponse.json({ success: true, url: loginUrl, status: "awaiting_code" }))
        }
      }

      proc.stdout?.on("data", handleData)
      proc.stderr?.on("data", handleData)

      proc.on("exit", (code) => {
        loginProcess = null
        if (loginStatus !== "idle") {
          loginStatus = code === 0 ? "idle" : "error"
        }
        if (code === 0) loginUrl = null
      })

      proc.on("error", (err) => {
        loginStatus = "error"
        loginProcess = null
        if (!resolved) {
          resolved = true
          resolve(NextResponse.json({ success: false, error: "Login process failed" }, { status: 500 }))
        }
      })

      // 15초 내에 URL이 안 나오면 타임아웃
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          loginStatus = "error"
          resolve(NextResponse.json({
            success: false,
            error: "로그인 URL을 가져오지 못했습니다. Claude CLI 설치 상태를 확인해주세요.",
          }, { status: 500 }))
        }
      }, 15000)
    })
  }

  // ── 2단계: 브라우저에서 받은 코드를 stdin으로 전송 ──
  if (action === "submit-code") {
    const { code } = body as { code?: string }
    if (!code?.trim()) {
      return NextResponse.json({ error: "코드를 입력해주세요" }, { status: 400 })
    }
    if (!loginProcess?.stdin) {
      return NextResponse.json(
        { error: "로그인 세션이 없습니다. 로그인을 다시 시작해주세요." },
        { status: 400 }
      )
    }

    try {
      loginProcess.stdin.write(code.trim() + "\n")
    } catch (e: any) {
      return NextResponse.json({ success: false, error: "코드 전송 실패: " + e.message }, { status: 500 })
    }

    // 폴링으로 인증 상태 확인 (최대 20초, 2초 간격)
    const checkAuth = async (): Promise<boolean> => {
      try {
        const { stdout, stderr } = await execAsync(`${claude} auth status 2>&1 || true`, { timeout: 8000 })
        const output = (stdout + stderr).trim()
        try {
          const jsonMatch = output.match(/\{[\s\S]*\}/)
          if (jsonMatch) return JSON.parse(jsonMatch[0]).loggedIn === true
        } catch {}
        return output.includes("Logged in")
      } catch {
        return false
      }
    }

    // 최대 20초 동안 2초마다 확인
    let loggedIn = false
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000))
      loggedIn = await checkAuth()
      if (loggedIn) break
    }

    if (loggedIn) {
      loginStatus = "idle"
      loginUrl = null
      if (loginProcess) {
        try { loginProcess.kill() } catch {}
        loginProcess = null
      }
      return NextResponse.json({ success: true, logged_in: true })
    }
    return NextResponse.json({ success: false, logged_in: false, error: "인증 확인 실패. 코드가 올바른지 확인해주세요." })
  }

  // ── 로그인 취소 ──
  if (action === "cancel-login") {
    if (loginProcess) {
      try { loginProcess.kill() } catch {}
      loginProcess = null
    }
    loginUrl = null
    loginStatus = "idle"
    return NextResponse.json({ success: true })
  }

  // ── 로그아웃 ──
  if (action === "logout") {
    try {
      await execAsync(`${claude} auth logout 2>&1`, { timeout: 10000 })
      return NextResponse.json({ success: true })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 })
    }
  }

  // ── 동작 테스트 ──
  if (action === "test") {
    try {
      const { stdout, stderr } = await execAsync(
        `${claude} -p "respond with exactly: CLAUDE_OK" --output-format text 2>&1`,
        { timeout: 30000 }
      )
      const output = (stdout + stderr).trim()
      return NextResponse.json({ success: output.includes("CLAUDE_OK") })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: "Test failed" })
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
