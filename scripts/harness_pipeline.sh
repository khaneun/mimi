#!/bin/bash
# ================================================================
# MarketPulse Harness Pipeline v2
# Anthropic Harness Design Pattern 완전 구현
#
# 핵심 개선:
# 1. 피드백 루프 (FAIL → 재생성 → 재평가, 최대 2회)
# 2. 파일 기반 상태 전달 (프롬프트 아닌 파일 참조)
# 3. 스프린트 계약 전체 전달
# 4. A→B 의존성 (A 완료 후 B가 A 결과 참조)
# 5. 자동 검증 (글자수, 날짜, 가격 체크)
# 6. 맥락 재설정 (깨끗한 상태 + 구조화된 인수)
# 7. 리트라이 최대 2회
# ================================================================

set -e
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${WORK_DIR}/logs"
LOG_FILE="${LOG_DIR}/harness_$(date +%Y-%m-%d).log"
CLAUDE="${HOME}/.local/bin/claude"
REPORTS_DIR="${WORK_DIR}/reports/macro"
DASHBOARD_DIR="${WORK_DIR}/examples/dashboard/public/reports/macro"
STATE_DIR="${WORK_DIR}/reports/.harness_state"
DATE=$(date +%Y-%m-%d)
DATETIME=$(date '+%Y-%m-%d %H:%M:%S KST')
MAX_RETRY=2

mkdir -p "${LOG_DIR}" "${REPORTS_DIR}" "${DASHBOARD_DIR}" "${STATE_DIR}"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "MarketPulse Harness Pipeline v3"
log "날짜: ${DATETIME}"
log "=========================================="

# ================================================================
# Phase 0: DATA SNAPSHOT
# 단일 시점에서 모든 데이터 수집 → snapshot.json
# 이후 모든 에이전트가 이 파일만 참조 (WebSearch 가격 조회 금지)
# ================================================================
log ""
log "=== Phase 0: DATA SNAPSHOT ==="

SNAPSHOT="${STATE_DIR}/snapshot.json"
VENV="${WORK_DIR}/.venv/bin/activate"
export PYTHONPATH="${WORK_DIR}"

cd "${WORK_DIR}" && source "${VENV}" 2>/dev/null
python3 "${WORK_DIR}/scripts/collect_snapshot.py" 2>&1 | tee -a "${LOG_FILE}"

if [ ! -f "${SNAPSHOT}" ]; then
  log "❌ 스냅샷 생성 실패 — 파이프라인 중단"
  exit 1
fi
log "스냅샷: $(wc -c < "${SNAPSHOT}") bytes"

# ================================================================
# Phase 1: PLANNER
# 파일 기반 상태: sprint_contract.md (전체 전달)
# ================================================================
log ""
log "=== Phase 1: PLANNER (solution-architect) ==="

SPRINT="${STATE_DIR}/sprint_contract.md"

"${CLAUDE}" -p "당신은 MarketPulse 솔루션 아키텍트(Planner)입니다.

오늘 ${DATE} 기준으로 스프린트 계약을 작성하세요.

## 데이터 스냅샷 (단일 시점 — 정합성 기준)
${SNAPSHOT} 파일을 읽고, 이 데이터를 기준으로 사양을 작성하세요.
모든 에이전트가 이 스냅샷의 가격/지수만 사용합니다.

## 작업 1: WebSearch로 시장 핵심 이벤트(뉴스/이슈만) 파악
- 코스피/코스닥 최근 동향
- 미국 증시 (S&P500, 나스닥)
- 원유/금/환율 동향
- 지정학 리스크 (중동, 러우)

## 작업 2: 12개 리포트 분석 사양
각 리포트가 반드시 포함해야 할 데이터 포인트를 명시:
- macro_economy_report: [필수 데이터...]
- commodity_report: [필수 데이터...]
- stock_market_report: [필수 데이터...]
- real_estate_report: [필수 데이터...]
- kospi_market_analysis_report: [필수 데이터...]
- foreign_selling_analysis_report: [필수 데이터...]
- oil_surge_impact_report: [필수 데이터...]
- war_historical_comparison_report: [필수 데이터...]
- final_investment_report: [필수 데이터...]
- timing_strategy_report: [필수 데이터...]
- portfolio_analysis_report: [필수 데이터...]
- monthly_report_2026-04: [필수 데이터...]

## 작업 3: 평가 기준 (자동 검증 가능하도록 구체적으로)
- 글자수: 각 리포트 3000자 이상
- 날짜: '${DATE}' 또는 '4월 6일' 문자열 포함
- 가격: KOSPI, S&P500, 금, WTI 최소 4개 지수 언급
- 결론: 매수/매도/홀드 중 하나의 명확한 판단 포함

${SPRINT} 파일에 저장하세요." \
  --allowedTools "WebSearch,WebFetch,Write" \
  --output-format text >> "${LOG_FILE}" 2>&1

log "스프린트 계약: $(wc -c < "${SPRINT}" 2>/dev/null || echo 0) bytes"

# ================================================================
# Phase 2a: GENERATOR A (독립 — 기초 분석 6개)
# 맥락 재설정: 깨끗한 상태 + 스프린트 계약 파일 참조
# ================================================================
log ""
log "=== Phase 2a: GENERATOR A (기초 분석) ==="

"${CLAUDE}" -p "당신은 Investment Alpha 에이전트 A (Generator)입니다.
작성일시: ${DATETIME}

## ⚠️ 중요: 데이터 정합성 규칙
가격/지수 데이터는 반드시 ${SNAPSHOT} 파일의 값만 사용하세요.
WebSearch는 뉴스/이슈/전망 조사에만 사용하고, 가격 조회에 사용하지 마세요.
스냅샷에 없는 데이터만 WebSearch로 보완하세요.

## 스프린트 계약
${SPRINT} 파일을 읽고 분석 사양을 따르세요.

## 작업: 6개 기초 분석 리포트 작성
${SNAPSHOT}의 가격 데이터를 기반으로, WebSearch로 뉴스/이슈를 조사하여 작성하세요.

1. ${REPORTS_DIR}/macro_economy_report.md — 거시경제 (금리, GDP, 인플레이션, 환율)
2. ${REPORTS_DIR}/commodity_report.md — 원자재 (금, 은, 원유, 구리)
3. ${REPORTS_DIR}/stock_market_report.md — 주식시장 (KOSPI, S&P500, 섹터)
4. ${REPORTS_DIR}/real_estate_report.md — 부동산 (서울, REITs)
5. ${REPORTS_DIR}/kospi_market_analysis_report.md — 코스피 종합 (기술적, 수급)
6. ${REPORTS_DIR}/foreign_selling_analysis_report.md — 외국인 매매 분석

## 규칙
- 한국어, 각 3000자 이상
- 상단에 '작성일시: ${DATETIME}' 기입
- Investing.com 데이터 교차검증
- 명확한 투자 판단(매수/홀드/매도) 포함" \
  --allowedTools "WebSearch,WebFetch,Read,Write" \
  --output-format text >> "${LOG_FILE}" 2>&1

log "에이전트 A 완료"

# ================================================================
# Phase 2b: GENERATOR B (A 결과 참조 — 종합 분석 6개)
# 핵심: A의 리포트를 읽고 참조하여 작성
# ================================================================
log ""
log "=== Phase 2b: GENERATOR B (종합 분석 — A 결과 참조) ==="

"${CLAUDE}" -p "당신은 Investment Alpha 에이전트 B (Generator)입니다.
작성일시: ${DATETIME}

## ⚠️ 중요: 데이터 정합성 규칙
가격/지수 데이터는 반드시 ${SNAPSHOT} 파일의 값만 사용하세요.
WebSearch는 뉴스/이슈/전망 조사에만 사용하고, 가격 조회에 사용하지 마세요.
에이전트 A의 리포트와 동일한 가격을 사용해야 합니다.

## 스프린트 계약
${SPRINT} 파일을 읽고 분석 사양을 따르세요.

## 중요: 에이전트 A의 기초 분석 참조
다음 6개 파일을 먼저 읽고, 이를 기반으로 종합 분석을 작성하세요:
- ${REPORTS_DIR}/macro_economy_report.md
- ${REPORTS_DIR}/commodity_report.md
- ${REPORTS_DIR}/stock_market_report.md
- ${REPORTS_DIR}/real_estate_report.md
- ${REPORTS_DIR}/kospi_market_analysis_report.md
- ${REPORTS_DIR}/foreign_selling_analysis_report.md

## 작업: 6개 종합 분석 리포트 작성
1. ${REPORTS_DIR}/oil_surge_impact_report.md — 유가 급등 영향 (A의 원자재+거시경제 참조)
2. ${REPORTS_DIR}/war_historical_comparison_report.md — 전쟁 비교 (1973/1990/2003 vs 2026)
3. ${REPORTS_DIR}/final_investment_report.md — 종합 투자 분석 (A의 6개 리포트 종합)
4. ${REPORTS_DIR}/timing_strategy_report.md — 매수 타이밍 전략 (4~6월 이벤트)
5. ${REPORTS_DIR}/portfolio_analysis_report.md — 포트폴리오 분석 (20종목)
6. ${REPORTS_DIR}/monthly_report_2026-04.md — 4월 월별 종합

## 포트폴리오 데이터
${WORK_DIR}/examples/dashboard/public/portfolio_data.json 파일 참조
${WORK_DIR}/examples/dashboard/public/dashboard_data.json 파일 참조

## 규칙
- 한국어, 각 3000자 이상
- 상단에 '작성일시: ${DATETIME}' 기입
- A의 분석과 일관된 결론
- 명확한 투자 판단 포함" \
  --allowedTools "WebSearch,WebFetch,Read,Write" \
  --output-format text >> "${LOG_FILE}" 2>&1

log "에이전트 B 완료"

# ================================================================
# Phase 3: EVALUATOR (피드백 루프 포함)
# 자동 검증 + AI 검증 → FAIL 시 재생성 요청
# ================================================================
log ""
log "=== Phase 3: EVALUATOR ==="

EVAL_RESULT="${STATE_DIR}/evaluation.md"
RETRY=0
OVERALL_PASS=false

while [ ${RETRY} -lt ${MAX_RETRY} ] && [ "${OVERALL_PASS}" != "true" ]; do
  RETRY=$((RETRY + 1))
  log "평가 라운드 ${RETRY}/${MAX_RETRY}"

  # --- 3a: 자동 검증 (스크립트) ---
  AUTO_FAIL=""

  # 스냅샷에서 KOSPI 값 추출 (정합성 기준)
  SNAP_KOSPI=$(python3 -c "import json; d=json.load(open('${SNAPSHOT}')); print(int(d.get('indices',{}).get('KOSPI',{}).get('value',0)))" 2>/dev/null || echo 0)

  for md_file in "${REPORTS_DIR}"/*.md; do
    [ -f "$md_file" ] || continue
    fname=$(basename "$md_file")
    chars=$(wc -c < "$md_file" | tr -d ' ')
    has_date=$(grep -c "${DATE}\|4월 6일\|April 6" "$md_file" 2>/dev/null || echo 0)

    # 글자수 체크
    if [ "$chars" -lt 3000 ]; then
      AUTO_FAIL="${AUTO_FAIL}\n  ❌ ${fname}: ${chars}자 (3000자 미만)"
    fi
    # 날짜 체크
    if [ "$has_date" -eq 0 ]; then
      AUTO_FAIL="${AUTO_FAIL}\n  ❌ ${fname}: 오늘 날짜(${DATE}) 미포함"
    fi
    # KOSPI 정합성 체크 (스냅샷 기준 ±2% 이내)
    if [ "${SNAP_KOSPI}" -gt 0 ] && echo "${fname}" | grep -qi "kospi\|macro_economy\|stock_market\|final_investment"; then
      REPORT_KOSPI=$(grep -oP '\d{1},\d{3}' "$md_file" 2>/dev/null | head -1 | tr -d ',')
      if [ -n "${REPORT_KOSPI}" ] && [ "${REPORT_KOSPI}" -gt 0 ]; then
        DIFF=$(( (REPORT_KOSPI - SNAP_KOSPI) * 100 / SNAP_KOSPI ))
        if [ "${DIFF#-}" -gt 2 ]; then
          AUTO_FAIL="${AUTO_FAIL}\n  ❌ ${fname}: KOSPI ${REPORT_KOSPI} vs 스냅샷 ${SNAP_KOSPI} (${DIFF}% 차이)"
        fi
      fi
    fi
  done

  if [ -n "${AUTO_FAIL}" ]; then
    log "자동 검증 실패:${AUTO_FAIL}"

    if [ ${RETRY} -lt ${MAX_RETRY} ]; then
      log "재생성 요청 (피드백 루프)..."

      # 실패한 리포트만 재생성
      FAILED_LIST=$(echo -e "${AUTO_FAIL}" | grep "❌" | sed 's/.*❌ //' | sed 's/:.*//')
      "${CLAUDE}" -p "다음 리포트가 품질 기준을 통과하지 못했습니다. 수정해주세요.

실패 내역:
${AUTO_FAIL}

스프린트 계약: ${SPRINT}
리포트 디렉토리: ${REPORTS_DIR}/

각 실패한 리포트를 다시 작성해주세요. 3000자 이상, 오늘 날짜(${DATE}) 포함 필수." \
        --allowedTools "WebSearch,WebFetch,Read,Write" \
        --output-format text >> "${LOG_FILE}" 2>&1

      continue
    fi
  fi

  # --- 3b: AI 검증 (교차검증) ---
  "${CLAUDE}" -p "당신은 MarketPulse QA 평가자(Evaluator)입니다.

## 작업: 12개 리포트 교차검증
${REPORTS_DIR}/ 디렉토리의 모든 .md 파일을 읽고 평가하세요.
스프린트 계약: ${SPRINT} 파일 참조.

## ⚠️ 핵심: 스냅샷 기반 데이터 정합성 검증
${SNAPSHOT} 파일을 읽고, 각 리포트에 기재된 가격/지수가 스냅샷과 일치하는지 확인하세요.
예: 스냅샷의 KOSPI가 5,377인데 리포트에 5,400으로 기재 → FAIL

## 평가 기준
1. 데이터 정합성 — 리포트 가격이 ${SNAPSHOT}과 일치하는가? (±1% 허용)
2. 일관성 — 12개 리포트 간 동일 지수가 같은 값인가?
3. 완성도 — 분석 근거와 출처가 있는가
4. 시의성 — ${DATE} 데이터 반영 여부

## 출력 형식 (${EVAL_RESULT}에 저장)
각 리포트별:
- [PASS/FAIL] 리포트명 — 이유
전체:
- OVERALL: PASS 또는 FAIL

OVERALL: PASS 또는 OVERALL: FAIL을 반드시 마지막에 기입." \
    --allowedTools "WebSearch,Read,Write,Glob,Grep" \
    --output-format text >> "${LOG_FILE}" 2>&1

  # PASS/FAIL 판정 확인
  if grep -qi "OVERALL.*PASS" "${EVAL_RESULT}" 2>/dev/null; then
    OVERALL_PASS=true
    log "✅ 평가 PASS (라운드 ${RETRY})"
  else
    log "❌ 평가 FAIL (라운드 ${RETRY})"
    if [ ${RETRY} -lt ${MAX_RETRY} ]; then
      log "피드백 루프: 재생성 요청..."
      FEEDBACK=$(grep "FAIL" "${EVAL_RESULT}" 2>/dev/null | head -10)
      "${CLAUDE}" -p "평가자가 다음 항목에서 FAIL을 판정했습니다:

${FEEDBACK}

해당 리포트를 수정해주세요. 리포트 디렉토리: ${REPORTS_DIR}/
스프린트 계약: ${SPRINT}" \
        --allowedTools "WebSearch,WebFetch,Read,Write" \
        --output-format text >> "${LOG_FILE}" 2>&1
    fi
  fi
done

log "최종 평가: $([ "${OVERALL_PASS}" = "true" ] && echo "PASS ✅" || echo "FAIL ❌ (배포 진행)")"

# ================================================================
# Phase 4: DEPLOY
# HTML 생성 + 대시보드 복사 + 아카이브
# ================================================================
log ""
log "=== Phase 4: DEPLOY ==="

CSS_FILE="${WORK_DIR}/examples/dashboard/public/reports/report-style.css"
HTML_COUNT=0
for md_file in "${REPORTS_DIR}"/*.md; do
  [ -f "$md_file" ] || continue
  html_file="${md_file%.md}.html"
  if command -v pandoc &>/dev/null; then
    pandoc "$md_file" -o "$html_file" --standalone \
      --metadata title="$(basename "$md_file" .md)" \
      --css="${CSS_FILE}" 2>/dev/null && HTML_COUNT=$((HTML_COUNT + 1))
  fi
done
log "HTML 생성: ${HTML_COUNT}개"

cp "${REPORTS_DIR}"/*.html "${DASHBOARD_DIR}/" 2>/dev/null
log "대시보드 복사 완료"

ARCHIVE_DIR="${WORK_DIR}/reports/archive/${DATE}"
mkdir -p "${ARCHIVE_DIR}"
cp "${REPORTS_DIR}"/*.md "${ARCHIVE_DIR}/" 2>/dev/null
cp "${REPORTS_DIR}"/*.html "${ARCHIVE_DIR}/" 2>/dev/null
cp "${SPRINT}" "${ARCHIVE_DIR}/" 2>/dev/null
cp "${EVAL_RESULT}" "${ARCHIVE_DIR}/" 2>/dev/null
log "아카이브: ${ARCHIVE_DIR}"

# 상태 파일 정리
rm -rf "${STATE_DIR}" 2>/dev/null

log ""
log "=========================================="
log "Harness Pipeline v2 완료"
log "  리포트: $(ls "${REPORTS_DIR}"/*.md 2>/dev/null | wc -l | tr -d ' ')개"
log "  HTML: ${HTML_COUNT}개"
log "  평가: $([ "${OVERALL_PASS}" = "true" ] && echo "PASS" || echo "FAIL")"
log "  리트라이: ${RETRY}회"
log "  아카이브: ${ARCHIVE_DIR}"
log "=========================================="
