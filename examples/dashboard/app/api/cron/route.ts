import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import { existsSync } from "fs"

const execAsync = promisify(exec)

// 식별 마커 — 이 문자열이 포함된 crontab 줄이 관리 대상
const CRON_MARKER = "# mimi-daily-pipeline"

function findProjectRoot(): string {
  if (process.env.WORK_DIR) return process.env.WORK_DIR
  const candidates = [
    path.resolve(process.cwd(), "../../"),
    "/home/ec2-user/mimi",
  ]
  for (const p of candidates) {
    if (existsSync(path.join(p, "reports"))) return p
  }
  return candidates[0]
}

const PROJECT_ROOT = findProjectRoot()

// 매일 21:00 KST (12:00 UTC)
const CRON_SCHEDULE = "0 12 * * *"
const CRON_CMD = `bash ${PROJECT_ROOT}/scripts/daily_run.sh all >> ${PROJECT_ROOT}/logs/daily_pipeline.log 2>&1`
const CRON_LINE = `${CRON_SCHEDULE} ${CRON_CMD} ${CRON_MARKER}`

async function getCrontab(): Promise<string> {
  try {
    const { stdout } = await execAsync("crontab -l 2>/dev/null || true")
    return stdout
  } catch {
    return ""
  }
}

async function setCrontab(content: string): Promise<void> {
  // 빈 crontab 설정 시 crontab -r과 동일 효과
  if (!content.trim()) {
    await execAsync("crontab -r 2>/dev/null || true")
    return
  }
  await execAsync(`echo ${JSON.stringify(content)} | crontab -`)
}

// GET: 스케줄 활성 여부 조회
export async function GET() {
  try {
    const crontab = await getCrontab()
    const enabled = crontab.includes(CRON_MARKER)
    return NextResponse.json({ enabled, schedule: "매일 오후 9시 (KST)" })
  } catch (e: any) {
    return NextResponse.json({ enabled: false, error: e.message })
  }
}

// POST: 스케줄 온/오프
export async function POST(req: NextRequest) {
  let body: { enable?: boolean }
  try { body = await req.json() } catch { body = {} }

  const { enable } = body
  if (enable === undefined) {
    return NextResponse.json({ error: "enable 파라미터 필요" }, { status: 400 })
  }

  try {
    const crontab = await getCrontab()
    const lines = crontab.split("\n")

    // 기존 관리 항목 제거
    const filtered = lines.filter(l => !l.includes(CRON_MARKER))

    if (enable) {
      // 마지막 빈 줄 처리 후 추가
      const base = filtered.join("\n").trimEnd()
      const next = base ? `${base}\n${CRON_LINE}\n` : `${CRON_LINE}\n`
      await setCrontab(next)
    } else {
      await setCrontab(filtered.join("\n").trimEnd() + (filtered.some(l => l.trim()) ? "\n" : ""))
    }

    return NextResponse.json({ success: true, enabled: enable })
  } catch (e: any) {
    console.error("[cron] error:", e.message)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
