#!/bin/bash
cd "$(dirname "$0")/.."
source .venv/bin/activate
export PYTHONPATH="$(pwd)"

# 환경변수 로드
export $(grep -v '^#' .env | xargs) 2>/dev/null

# 시작 시 뉴스 즉시 갱신
echo "[$(date '+%H:%M:%S')] 시작 — 뉴스 즉시 갱신"
python3 pipeline/news_crawler.py &

# 실시간 시세 (1분마다) + 뉴스 (5분마다) 병렬 실행
COUNTER=0
while true; do
    # 실시간 시세 갱신 (KIS API)
    python3 pipeline/realtime_server.py once

    COUNTER=$((COUNTER + 1))

    # 5분(300초)마다 뉴스 갱신 (60초 × 5 = 300)
    if [ $((COUNTER % 5)) -eq 0 ]; then
        echo "[$(date '+%H:%M:%S')] 뉴스 갱신 시작... (5분 주기)"
        python3 pipeline/news_crawler.py &
    fi

    sleep ${1:-60}
done
