import { NextRequest, NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
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
    return NextResponse.json(
      { error: `Failed to read execution log: ${(err as Error).message}` },
      { status: 500 }
    )
  }
}
