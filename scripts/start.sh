#!/usr/bin/env bash
# Mimi Trader — 서비스 기동 스크립트
# 사용법: ./scripts/start.sh [dashboard|realtime|all|status|stop]

set -euo pipefail
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PYTHONPATH="${WORK_DIR}"
PYTHON="${WORK_DIR}/.venv/bin/python"
LOG_DIR="${WORK_DIR}/logs"
mkdir -p "${LOG_DIR}"

PID_DASHBOARD="${LOG_DIR}/dashboard.pid"
PID_REALTIME="${LOG_DIR}/realtime.pid"

# ── AWS Secrets Manager 로드 ──────────────────────────────────────────
echo ">>> 시크릿 로드 중..."
"${PYTHON}" -c "
import sys; sys.path.insert(0, '${WORK_DIR}')
from utils.load_secrets import load_env
load_env()
# 로드된 시크릿 확인
import os
keys = ['KIS_PAPER_APP_KEY','TELEGRAM_BOT_TOKEN','OPENAI_API_KEY']
for k in keys:
    v = os.getenv(k,'')
    print(f'  {k}: {v[:6]}...{v[-4:]}' if len(v)>10 else f'  {k}: {\"미설정\" if not v else \"설정됨\"}')
" 2>&1 || echo "  (시크릿 로드 실패 — .env.local 확인 필요)"

# ── 함수 ──────────────────────────────────────────────────────────────
start_dashboard() {
    echo ">>> 대시보드 시작 (port ${DASHBOARD_PORT:-3000})..."
    cd "${WORK_DIR}/examples/dashboard"
    # 빌드가 없으면 빌드 먼저
    if [ ! -d ".next" ]; then
        echo "  빌드 중..."
        npm run build
    fi
    nohup npm start -- -p "${DASHBOARD_PORT:-3000}" \
        > "${LOG_DIR}/dashboard.log" 2>&1 &
    echo $! > "${PID_DASHBOARD}"
    echo "  PID: $(cat ${PID_DASHBOARD})"
    echo "  로그: ${LOG_DIR}/dashboard.log"
    echo "  URL: http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}'):${DASHBOARD_PORT:-3000}"
}

start_realtime() {
    echo ">>> 실시간 서버 시작..."
    cd "${WORK_DIR}"
    nohup "${PYTHON}" -m pipeline.realtime_server \
        > "${LOG_DIR}/realtime.log" 2>&1 &
    echo $! > "${PID_REALTIME}"
    echo "  PID: $(cat ${PID_REALTIME})"
    echo "  로그: ${LOG_DIR}/realtime.log"
}

stop_service() {
    local pidfile="$1"
    local name="$2"
    if [ -f "${pidfile}" ]; then
        local pid=$(cat "${pidfile}")
        if kill -0 "${pid}" 2>/dev/null; then
            kill "${pid}" && echo "  ${name} 중단 (PID ${pid})"
        else
            echo "  ${name} 이미 중단됨"
        fi
        rm -f "${pidfile}"
    else
        echo "  ${name} PID 파일 없음"
    fi
}

show_status() {
    echo "=== Mimi Trader 상태 ==="
    for entry in "대시보드:${PID_DASHBOARD}" "실시간서버:${PID_REALTIME}"; do
        name="${entry%%:*}"
        pidfile="${entry#*:}"
        if [ -f "${pidfile}" ]; then
            pid=$(cat "${pidfile}")
            if kill -0 "${pid}" 2>/dev/null; then
                echo "  ${name}: 실행중 (PID ${pid})"
            else
                echo "  ${name}: 중단됨 (stale PID)"
            fi
        else
            echo "  ${name}: 미실행"
        fi
    done
}

# ── 메인 ──────────────────────────────────────────────────────────────
CMD="${1:-all}"
case "${CMD}" in
    dashboard) start_dashboard ;;
    realtime)  start_realtime ;;
    all)
        start_realtime
        start_dashboard
        echo ""
        show_status
        ;;
    stop)
        stop_service "${PID_DASHBOARD}" "대시보드"
        stop_service "${PID_REALTIME}"  "실시간서버"
        ;;
    status) show_status ;;
    *)
        echo "사용법: $0 [dashboard|realtime|all|status|stop]"
        exit 1
        ;;
esac
