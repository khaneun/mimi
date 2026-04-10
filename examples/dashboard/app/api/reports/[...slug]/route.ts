import { NextRequest, NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import path from "path"

// 환경변수 > 상대경로 우선순위로 reports 디렉토리 탐색
function findReportsDir(): string {
  if (process.env.REPORTS_DIR) return process.env.REPORTS_DIR
  const candidates = [
    path.resolve(process.cwd(), "../../reports"),          // cwd = examples/dashboard
    path.resolve(process.cwd(), "../../../reports"),        // cwd = examples/dashboard/.next
    path.resolve(__dirname, "../../../../../../reports"),   // __dirname = .next/server/...
    path.resolve(__dirname, "../../../../../../../reports"),
    "/home/ec2-user/mimi/reports",                          // EC2 절대경로 fallback
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}
const REPORTS_DIR = findReportsDir()

/** 마크다운을 간단한 HTML로 변환 (외부 라이브러리 불필요) */
function mdToHtml(md: string): string {
  let html = md
    // 코드 블록 (```lang ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escHtml(code.trimEnd())}</code></pre>`
    )
    // 인라인 코드
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // 헤더 (h1~h6)
    .replace(/^#{6}\s(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s(.+)$/gm, "<h4>$1</h4>")
    .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
    // 수평선
    .replace(/^---$/gm, "<hr>")
    // 굵게 / 기울임
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 테이블
    .replace(/(\|.+\|\n)((?:\|[-: ]+)+\|\n)((?:\|.+\|\n?)*)/g, (match, header, _sep, rows) => {
      const th = header.split("|").slice(1, -1).map((c: string) => `<th>${c.trim()}</th>`).join("")
      const trs = rows.trim().split("\n").map((row: string) =>
        "<tr>" + row.split("|").slice(1, -1).map((c: string) => `<td>${c.trim()}</td>`).join("") + "</tr>"
      ).join("\n")
      return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
    })
    // 목록 (- item)
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // 번호 목록
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // 단락 (빈 줄로 구분)
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<(h[1-6]|ul|ol|li|table|pre|hr)/.test(block.trim())) return block
      const trimmed = block.trim()
      if (!trimmed) return ""
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`
    })
    .join("\n")

  return html
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug ?? []
  // /reports/macro/macro_economy_report.html → macro/macro_economy_report
  const filePath = slug.join("/").replace(/\.html?$/, "")

  // 1. HTML 파일 먼저 탐색
  const htmlPath = path.join(REPORTS_DIR, filePath + ".html")
  if (existsSync(htmlPath)) {
    const content = readFileSync(htmlPath, "utf-8")
    return new NextResponse(content, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  // 2. 마크다운 파일 탐색 후 변환
  const mdPath = path.join(REPORTS_DIR, filePath + ".md")
  if (existsSync(mdPath)) {
    const md = readFileSync(mdPath, "utf-8")
    const body = mdToHtml(md)
    const title = slug[slug.length - 1]?.replace(/_/g, " ") ?? "리포트"
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
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  // 3. 파일 없음
  return new NextResponse(
    `<html><body style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:2rem">
      <h2>리포트를 찾을 수 없습니다</h2>
      <p style="color:#94a3b8">경로: ${filePath}</p>
      <p style="color:#94a3b8">파이프라인 실행 후 리포트가 생성됩니다.</p>
      <p><code>./scripts/daily_run.sh all</code></p>
    </body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}
