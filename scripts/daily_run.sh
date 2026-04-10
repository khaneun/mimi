#!/bin/bash
# MarketPulse + MarketPulse 일일 파이프라인 실행 스크립트
# 사용: ./scripts/daily_run.sh [macro|stocks|all]
# all 모드: 매크로분석 + 종목분석 + HTML생성 + 아카이브 + 대시보드 갱신(시세/뉴스/관심종목)

WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${WORK_DIR}/logs"
LOG_FILE="${LOG_DIR}/pipeline_$(date +%Y-%m-%d).log"
VENV="${WORK_DIR}/.venv/bin/activate"
export PYTHONPATH="${WORK_DIR}"

mkdir -p "${LOG_DIR}"

echo "=== MarketPulse 파이프라인 시작: $(date '+%Y-%m-%d %H:%M:%S KST') ===" >> "${LOG_FILE}"

cd "${WORK_DIR}" && source "${VENV}"

# 환경변수 로드
export $(grep -v '^#' .env | xargs)

# 데이터 검증 (실패 시 파이프라인 중단)
echo "=== 데이터 검증 시작 ===" >> "${LOG_FILE}"
python3 "${WORK_DIR}/scripts/validate_data.py" >> "${LOG_FILE}" 2>&1
if [ $? -ne 0 ]; then
    echo "=== 데이터 검증 실패 - 파이프라인 중단: $(date '+%Y-%m-%d %H:%M:%S KST') ===" >> "${LOG_FILE}"
    exit 1
fi

MODE=${1:-all}

case ${MODE} in
    macro)
        python -m pipeline.macro_pipeline >> "${LOG_FILE}" 2>&1
        python -m pipeline.archive_pipeline >> "${LOG_FILE}" 2>&1
        ;;
    stocks)
        python -m pipeline.stock_pipeline 000660 SK하이닉스 >> "${LOG_FILE}" 2>&1
        python -m pipeline.stock_pipeline 005930 삼성전자 >> "${LOG_FILE}" 2>&1
        python -m pipeline.archive_pipeline >> "${LOG_FILE}" 2>&1
        ;;
    harness)
        # Harness Pattern: Planner → Generator(2병렬) → Evaluator → Deploy
        echo "=== Harness Pipeline 시작 ===" >> "${LOG_FILE}"
        "${WORK_DIR}/scripts/harness_pipeline.sh" >> "${LOG_FILE}" 2>&1
        ;;
    all)
        python -m pipeline.daily_pipeline >> "${LOG_FILE}" 2>&1
        ;;
    *)
        echo "Usage: $0 [macro|stocks|all|harness]"
        exit 1
        ;;
esac

echo "=== 완료: $(date '+%Y-%m-%d %H:%M:%S KST') ===" >> "${LOG_FILE}"
