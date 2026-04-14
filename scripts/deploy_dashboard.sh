#!/bin/bash
# EC2 대시보드 배포 스크립트
# 사용법: ./scripts/deploy_dashboard.sh

EC2="ec2-user@52.79.137.187"
KEY="$HOME/kitty-key.pem"
APP_DIR="/home/ec2-user/mimi"
DASH_DIR="$APP_DIR/examples/dashboard"
LOG_FILE="$APP_DIR/logs/dashboard.log"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no"

# ── [1/3] git pull ──────────────────────────────────────────────
echo "▶ [1/3] EC2 git pull"
$SSH "$EC2" "cd $APP_DIR && git pull origin main" || { echo "✗ git pull 실패"; exit 1; }

# ── [2/3] 빌드 ──────────────────────────────────────────────────
echo "▶ [2/3] 빌드"
$SSH "$EC2" "cd $DASH_DIR && npm run build" || { echo "✗ 빌드 실패"; exit 1; }

# ── [3/3] 서버 재시작 ───────────────────────────────────────────
# setsid로 새 세션 생성 → SSH 종료 시 프로세스 유지, 즉시 반환
echo "▶ [3/3] 서버 재시작"
$SSH "$EC2" "
  pkill -f 'next-server' 2>/dev/null || true
  pkill -f 'next start'  2>/dev/null || true
  sleep 1
  mkdir -p $APP_DIR/logs
  cd $DASH_DIR && setsid nohup node_modules/.bin/next start -p 3000 \
    >>$LOG_FILE 2>&1 </dev/null &
  disown \$!
  echo '서버 시작됨'
"

# ── 확인 (로컬 3초 대기 후 별도 SSH로 체크) ─────────────────────
echo "▶ 확인 중..."
sleep 3
$SSH "$EC2" "
  for i in \$(seq 1 10); do
    PID=\$(pgrep -f 'next-server' | head -1)
    if [ -n \"\$PID\" ]; then
      STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
      echo \"✅ 배포 완료 — PID: \$PID, HTTP \$STATUS\"
      exit 0
    fi
    sleep 2
  done
  echo '✗ 서버 응답 없음'
  exit 1
"
