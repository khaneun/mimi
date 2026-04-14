#!/bin/bash
# EC2 대시보드 배포 스크립트
# 사용법: ./scripts/deploy_dashboard.sh

EC2="ec2-user@52.79.137.187"
KEY="$HOME/kitty-key.pem"
APP_DIR="/home/ec2-user/mimi"
DASH_DIR="$APP_DIR/examples/dashboard"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/dashboard.log"
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
$SSH "$EC2" "
  # PID 파일로 기존 프로세스 종료
  if [ -f $PID_FILE ]; then
    OLD_PID=\$(cat $PID_FILE)
    kill \$OLD_PID 2>/dev/null || true
    rm -f $PID_FILE
  fi
  # 혹시 남은 next 프로세스도 정리
  pkill -f 'next-server' 2>/dev/null || true
  pkill -f 'next start'  2>/dev/null || true
  sleep 2

  mkdir -p $LOG_DIR
  cd $DASH_DIR

  # start.sh와 동일한 방식으로 기동
  REPORTS_DIR=$APP_DIR/reports \
  nohup npm start -- -p 3000 \
    > $LOG_FILE 2>&1 &
  echo \$! > $PID_FILE
  echo \"서버 PID: \$(cat $PID_FILE)\"
"

# ── 확인 ────────────────────────────────────────────────────────
echo "▶ 확인 중..."
$SSH "$EC2" "
  for i in \$(seq 1 15); do
    STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
    PID=\$(cat $PID_FILE 2>/dev/null)
    if [ \"\$STATUS\" = '200' ]; then
      echo \"✅ 배포 완료 — PID: \$PID, HTTP \$STATUS\"
      exit 0
    fi
    # 프로세스 생존 확인
    if [ -n \"\$PID\" ] && ! kill -0 \$PID 2>/dev/null; then
      echo '✗ 서버 프로세스가 종료됨'
      tail -20 $LOG_FILE
      exit 1
    fi
    echo \"  대기 중... \${i}/15 (HTTP \$STATUS)\"
    sleep 2
  done
  echo '✗ 서버 응답 없음 (타임아웃)'
  tail -10 $LOG_FILE
  exit 1
"
