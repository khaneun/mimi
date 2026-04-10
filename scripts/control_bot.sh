#!/bin/bash
# Mimi Control Bot 실행 스크립트
# 사용: ./scripts/control_bot.sh [start|stop|restart|status]

WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${WORK_DIR}/.venv/bin/activate"
LOG_FILE="${WORK_DIR}/logs/control_bot.log"
PID_FILE="${WORK_DIR}/logs/control_bot.pid"

export PYTHONPATH="${WORK_DIR}"

mkdir -p "${WORK_DIR}/logs"

start() {
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        echo "이미 실행 중 (PID: $(cat "${PID_FILE}"))"
        exit 0
    fi

    source "${VENV}" 2>/dev/null
    export $(grep -v '^#' "${WORK_DIR}/.env" | grep -v '^$' | xargs) 2>/dev/null

    echo "Mimi Control Bot 시작..."
    nohup python3 -m pipeline.telegram_control_bot >> "${LOG_FILE}" 2>&1 &
    echo $! > "${PID_FILE}"
    echo "시작 완료 (PID: $(cat "${PID_FILE}"))"
}

stop() {
    if [ -f "${PID_FILE}" ]; then
        PID=$(cat "${PID_FILE}")
        if kill -0 "${PID}" 2>/dev/null; then
            kill "${PID}"
            rm -f "${PID_FILE}"
            echo "중단 완료 (PID: ${PID})"
        else
            echo "프로세스가 이미 종료됨"
            rm -f "${PID_FILE}"
        fi
    else
        # PID 파일 없으면 프로세스 이름으로 검색
        PIDS=$(pgrep -f "telegram_control_bot" | tr '\n' ' ')
        if [ -n "${PIDS}" ]; then
            kill ${PIDS}
            echo "중단 완료 (PID: ${PIDS})"
        else
            echo "실행 중인 컨트롤 봇 없음"
        fi
    fi
}

status() {
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        echo "🟢 실행 중 (PID: $(cat "${PID_FILE}"))"
    else
        PIDS=$(pgrep -f "telegram_control_bot" | tr '\n' ' ')
        if [ -n "${PIDS}" ]; then
            echo "🟢 실행 중 (PID: ${PIDS})"
        else
            echo "🔴 중단됨"
        fi
    fi
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    *)
        echo "사용법: $0 [start|stop|restart|status]"
        exit 1
        ;;
esac
