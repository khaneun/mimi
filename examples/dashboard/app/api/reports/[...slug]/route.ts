import { NextRequest, NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import path from "path"

function findReportsDir(): string {
  if (process.env.REPORTS_DIR) return process.env.REPORTS_DIR
  const candidates = [
    path.resolve(process.cwd(), "../../reports"),
    path.resolve(process.cwd(), "../../../reports"),
    path.resolve(__dirname, "../../../../../../reports"),
    path.resolve(__dirname, "../../../../../../../reports"),
    "/home/ec2-user/mimi/reports",
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}
const REPORTS_DIR = path.resolve(findReportsDir())

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** 마크다운을 간단한 HTML로 변환 — 모든 텍스트를 escHtml 처리 */
function mdToHtml(md: string): string {
  let html = md
    // 코드 블록
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${escHtml(lang)}">${escHtml(code.trimEnd())}</code></pre>`
    )
    // 인라인 코드
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // 헤더 (h1~h6) — 캡처 그룹도 이스케이프
    .replace(/^#{6}\s(.+)$/gm, (_, t) => `<h6>${escHtml(t)}</h6>`)
    .replace(/^#{5}\s(.+)$/gm, (_, t) => `<h5>${escHtml(t)}</h5>`)
    .replace(/^#{4}\s(.+)$/gm, (_, t) => `<h4>${escHtml(t)}</h4>`)
    .replace(/^#{3}\s(.+)$/gm, (_, t) => `<h3>${escHtml(t)}</h3>`)
    .replace(/^#{2}\s(.+)$/gm, (_, t) => `<h2>${escHtml(t)}</h2>`)
    .replace(/^#{1}\s(.+)$/gm, (_, t) => `<h1>${escHtml(t)}</h1>`)
    // 수평선
    .replace(/^---$/gm, "<hr>")
    // 굵게/기울임
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => `<strong><em>${escHtml(t)}</em></strong>`)
    .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escHtml(t)}</strong>`)
    .replace(/\*(.+?)\*/g, (_, t) => `<em>${escHtml(t)}</em>`)
    // 테이블
    .replace(/(\|.+\|\n)((?:\|[-: ]+)+\|\n)((?:\|.+\|\n?)*)/g, (match, header, _sep, rows) => {
      const th = header.split("|").slice(1, -1).map((c: string) => `<th>${escHtml(c.trim())}</th>`).join("")
      const trs = rows.trim().split("\n").map((row: string) =>
        "<tr>" + row.split("|").slice(1, -1).map((c: string) => `<td>${escHtml(c.trim())}</td>`).join("") + "</tr>"
      ).join("\n")
      return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
    })
    // 목록
    .replace(/^- (.+)$/gm, (_, t) => `<li>${escHtml(t)}</li>`)
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, (_, t) => `<li>${escHtml(t)}</li>`)
    // 단락
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<(h[1-6]|ul|ol|li|table|pre|hr)/.test(block.trim())) return block
      const trimmed = block.trim()
      if (!trimmed) return ""
      return `<p>${escHtml(trimmed).replace(/\n/g, "<br>")}</p>`
    })
    .join("\n")

  return html
}

/** slug 세그먼트의 path traversal 방지 검증 */
function validateSlug(segments: string[]): boolean {
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg.includes("\\") || seg.includes("\0")) return false
    // 숨김 파일/디렉토리 차단
    if (seg.startsWith(".")) return false
  }
  return true
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug ?? []

  // Path traversal 차단
  if (!validateSlug(slug)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const filePath = slug.join("/").replace(/\.html?$/, "")

  // 최종 경로가 REPORTS_DIR 내에 있는지 검증
  const resolvedHtml = path.resolve(REPORTS_DIR, filePath + ".html")
  const resolvedMd = path.resolve(REPORTS_DIR, filePath + ".md")
  if (!resolvedHtml.startsWith(REPORTS_DIR) || !resolvedMd.startsWith(REPORTS_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  // 1. HTML 파일 먼저 탐색
  if (existsSync(resolvedHtml)) {
    const content = readFileSync(resolvedHtml, "utf-8")
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  // 2. 마크다운 파일 탐색 후 변환
  if (existsSync(resolvedMd)) {
    const md = readFileSync(resolvedMd, "utf-8")
    const body = mdToHtml(md)
    const title = escHtml(slug[slug.length - 1]?.replace(/_/g, " ") ?? "리포트")
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem;
           background: #0f1117; color: #e2e8f0; line-height: 1.7; }
    h1 { font-size: 1.8rem; border-bottom: 2px solid #3b82f6; padding-bottom: .5rem; color: #93c5fd; }
    h2 { font-size: 1.4rem; color: #7dd3fc; margin-top: 2rem; }
    h3 { font-size: 1.15rem; color: #bae6fd; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th { background: #1e293b; color: #7dd3fc; padding: .6rem .9rem; border: 1px solid #334155; }
    td { padding: .5rem .9rem; border: 1px solid #1e293b; }
    tr:nth-child(even) td { background: #111827; }
    pre { background: #1e293b; border-radius: 6px; padding: 1rem; overflow-x: auto; }
    code { background: #1e293b; padding: .15rem .4rem; border-radius: 4px; font-size: .9em; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #334155; margin: 2rem 0; }
    strong { color: #fbbf24; }
    a { color: #60a5fa; }
    p { margin: .8rem 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  // 3. 파일 없음 — filePath 이스케이프하여 XSS 방지
  return new NextResponse(
    `<html><body style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:2rem">
      <h2>리포트를 찾을 수 없습니다</h2>
      <p style="color:#94a3b8">경로: ${escHtml(filePath)}</p>
      <p style="color:#94a3b8">파이프라인 실행 후 리포트가 생성됩니다.</p>
      <p><code>./scripts/daily_run.sh all</code></p>
    </body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" } }
  )
}
