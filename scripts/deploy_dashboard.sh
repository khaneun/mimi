#!/bin/bash
# EC2 대시보드 배포 스크립트
# 사용법: ./scripts/deploy_dashboard.sh

EC2="ec2-user@52.79.137.187"
KEY="$HOME/kitty-key.pem"
APP_DIR="/home/ec2-user/mimi"
DASH_DIR="$APP_DIR/examples/dashboard"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/nextjs.log"    # npm start(concurrently)와 분리된 전용 로그
PID_FILE="$LOG_DIR/dashboard.pid"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no"

# ── [1/3] git pull ──────────────────────────────────────────────
echo "▶ [1/3] EC2 git pull"
$SSH "$EC2" "cd $APP_DIR && git pull origin main" || { echo "✗ git pull 실패"; exit 1; }

# ── [2/3] 빌드 ──────────────────────────────────────────────────
echo "▶ [2/3] 빌드"
$SSH "$EC2" "cd $DASH_DIR && npm run build" || { echo "✗ 빌드 실패"; exit 1; }

# ── [3/3] 서버 재시작 ───────────────────────────────────────────
echo "▶ [3/3] 서버 재시작"
$SSH "$EC2" bash << 'ENDSSH'
  APP_DIR="/home/ec2-user/mimi"
  DASH_DIR="$APP_DIR/examples/dashboard"
  LOG_DIR="$APP_DIR/logs"
  LOG_FILE="$LOG_DIR/nextjs.log"
  PID_FILE="$LOG_DIR/dashboard.pid"

  # 기존 프로세스 정리
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    kill "$OLD_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  pkill -f 'next-server' 2>/dev/null || true
  pkill -f 'next start'  2>/dev/null || true
  pkill -f 'concurrently' 2>/dev/null || true
  sleep 2

  mkdir -p "$LOG_DIR"

  # setsid로 새 세션(컨트롤 터미널 없음) → SIGHUP 무관
  # next start 직접 실행 (concurrently 경유 X → SIGHUP 전파 없음)
  setsid bash -c "
    cd '$DASH_DIR'
    exec node_modules/.bin/next start -p 3000
  " >> "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "서버 PID: $(cat $PID_FILE)"
ENDSSH

# ── 확인 ────────────────────────────────────────────────────────
echo "▶ 확인 중..."
$SSH "$EC2" bash << 'ENDSSH'
  LOG_FILE="/home/ec2-user/mimi/logs/nextjs.log"
  PID_FILE="/home/ec2-user/mimi/logs/dashboard.pid"

  for i in $(seq 1 20); do
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
    PID=$(cat "$PID_FILE" 2>/dev/null)

    if [ "$STATUS" = "200" ]; then
      echo "✅ 배포 완료 — PID: $PID, HTTP $STATUS"
      exit 0
    fi

    if [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; then
      echo "✗ 서버 프로세스 종료됨 (PID $PID)"
      echo "--- 최근 로그 ---"
      tail -20 "$LOG_FILE"
      exit 1
    fi

    echo "  대기 중... ${i}/20 (HTTP $STATUS)"
    sleep 2
  done

  echo "✗ 타임아웃 — 최근 로그:"
  tail -15 "$LOG_FILE"
  exit 1
ENDSSH
