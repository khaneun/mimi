#!/usr/bin/env python3
"""
reports/ 디렉토리의 .md 파일을 .html로 변환
daily_pipeline 실행 후 자동 호출되어 대시보드 리포트 뷰어에서 접근 가능하게 함
"""
import re
import sys
from pathlib import Path

REPORTS_DIR = Path(__file__).parent.parent / "reports"

STYLE = """
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 880px; margin: 0 auto; padding: 2rem 1.5rem;
         background: #0f1117; color: #e2e8f0; line-height: 1.75; }
  h1 { font-size: 1.9rem; border-bottom: 2px solid #3b82f6;
       padding-bottom: .5rem; margin-top: 2rem; color: #93c5fd; }
  h2 { font-size: 1.45rem; color: #7dd3fc; margin-top: 2rem; }
  h3 { font-size: 1.15rem; color: #bae6fd; }
  h4 { font-size: 1rem; color: #a5f3fc; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem; }
  th { background: #1e293b; color: #7dd3fc; padding: .55rem .85rem;
       border: 1px solid #334155; text-align: left; }
  td { padding: .45rem .85rem; border: 1px solid #1e293b; }
  tr:nth-child(even) td { background: #111827; }
  pre { background: #1e293b; border-radius: 8px; padding: 1rem; overflow-x: auto; }
  code { background: #1e293b; padding: .15rem .4rem; border-radius: 4px; font-size: .88em; color: #f472b6; }
  pre code { background: none; padding: 0; color: #e2e8f0; }
  hr { border: none; border-top: 1px solid #334155; margin: 2rem 0; }
  strong { color: #fbbf24; }
  em { color: #a5f3fc; }
  a { color: #60a5fa; }
  blockquote { border-left: 3px solid #3b82f6; margin: 1rem 0; padding: .5rem 1rem;
               background: #1e293b; border-radius: 0 6px 6px 0; color: #94a3b8; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: .3rem 0; }
  p { margin: .85rem 0; }
</style>
"""


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def md_to_html(md: str) -> str:
    lines = md.split("\n")
    out = []
    in_code = False
    code_buf: list[str] = []
    code_lang = ""
    in_table = False
    table_buf: list[str] = []
    list_buf: list[str] = []
    list_type = ""

    def flush_list():
        nonlocal list_buf, list_type
        if list_buf:
            tag = "ul" if list_type == "ul" else "ol"
            out.append(f"<{tag}>{''.join(list_buf)}</{tag}>")
            list_buf = []
            list_type = ""

    def flush_table():
        nonlocal table_buf, in_table
        if table_buf:
            header, *rows = table_buf
            ths = [f"<th>{c.strip()}</th>" for c in header.split("|") if c.strip()]
            trs = []
            for row in rows:
                tds = [f"<td>{inline(c.strip())}</td>" for c in row.split("|") if c.strip()]
                if tds:
                    trs.append(f"<tr>{''.join(tds)}</tr>")
            out.append(f"<table><thead><tr>{''.join(ths)}</tr></thead><tbody>{''.join(trs)}</tbody></table>")
            table_buf = []
            in_table = False

    def inline(s: str) -> str:
        # 코드
        s = re.sub(r"`([^`]+)`", lambda m: f"<code>{esc(m.group(1))}</code>", s)
        # 굵게/이탤릭
        s = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
        # 링크
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
        return s

    i = 0
    while i < len(lines):
        line = lines[i]

        # 코드 블록
        if line.startswith("```"):
            if in_code:
                code_html = esc("\n".join(code_buf))
                out.append(f'<pre><code class="language-{code_lang}">{code_html}</code></pre>')
                code_buf = []
                in_code = False
            else:
                flush_list()
                flush_table()
                code_lang = line[3:].strip()
                in_code = True
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # 테이블 구분선 skip
        if re.match(r"^\|[-|: ]+\|$", line.strip()):
            i += 1
            continue

        # 테이블 행
        if line.strip().startswith("|") and line.strip().endswith("|"):
            flush_list()
            in_table = True
            table_buf.append(line.strip()[1:-1])
            i += 1
            continue
        else:
            flush_table()

        # 헤더
        m = re.match(r"^(#{1,6})\s(.+)$", line)
        if m:
            flush_list()
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1
            continue

        # 수평선
        if re.match(r"^---+$", line.strip()):
            flush_list()
            out.append("<hr>")
            i += 1
            continue

        # 인용
        if line.startswith("> "):
            flush_list()
            out.append(f"<blockquote>{inline(line[2:])}</blockquote>")
            i += 1
            continue

        # 비순서 목록
        m = re.match(r"^[-*+]\s(.+)$", line)
        if m:
            if list_type and list_type != "ul":
                flush_list()
            list_type = "ul"
            list_buf.append(f"<li>{inline(m.group(1))}</li>")
            i += 1
            continue

        # 순서 목록
        m = re.match(r"^\d+\.\s(.+)$", line)
        if m:
            if list_type and list_type != "ol":
                flush_list()
            list_type = "ol"
            list_buf.append(f"<li>{inline(m.group(1))}</li>")
            i += 1
            continue

        flush_list()

        # 빈 줄
        if not line.strip():
            out.append("")
            i += 1
            continue

        # 일반 텍스트 → 단락
        out.append(f"<p>{inline(line)}</p>")
        i += 1

    flush_list()
    flush_table()
    return "\n".join(out)


def convert_file(md_path: Path) -> Path:
    html_path = md_path.with_suffix(".html")
    md = md_path.read_text(encoding="utf-8")
    title = md_path.stem.replace("_", " ")
    body = md_to_html(md)
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  {STYLE}
</head>
<body>
{body}
</body>
</html>"""
    html_path.write_text(html, encoding="utf-8")
    return html_path


def main():
    converted = 0
    for md_file in sorted(REPORTS_DIR.rglob("*.md")):
        try:
            html_path = convert_file(md_file)
            print(f"  ✅ {md_file.name} → {html_path.name}")
            converted += 1
        except Exception as e:
            print(f"  ⚠️  {md_file.name}: {e}")
    print(f"\n총 {converted}개 변환 완료")


if __name__ == "__main__":
    main()
