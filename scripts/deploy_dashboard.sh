#!/bin/bash
# EC2 대시보드 배포 스크립트
# 사용법: ./scripts/deploy_dashboard.sh
# 동작: git push 확인 → EC2 git pull → 빌드 → 서버 재시작

set -e

EC2="ec2-user@52.79.137.187"
KEY="$HOME/kitty-key.pem"
APP_DIR="/home/ec2-user/mimi"
DASH_DIR="$APP_DIR/examples/dashboard"
LOG_FILE="$APP_DIR/logs/dashboard.log"

echo "▶ [1/3] EC2 git pull (origin/main)"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$EC2" "
  cd $APP_DIR
  git pull origin main
"

echo "▶ [2/3] 빌드"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$EC2" "
  cd $DASH_DIR
  npm run build
"

echo "▶ [3/3] 서버 재시작"
# 기존 프로세스 종료
ssh -i "$KEY" -o StrictHostKeyChecking=no "$EC2" \
  "pkill -f 'standalone/server.js' 2>/dev/null || true; mkdir -p $APP_DIR/logs"
# 새 프로세스 시작 (SSH 연결 종료와 무관하게 실행)
ssh -i "$KEY" -o StrictHostKeyChecking=no "$EC2" \
  "nohup node $DASH_DIR/.next/standalone/server.js >> $LOG_FILE 2>&1 </dev/null &"
# 별도 연결로 확인
ssh -i "$KEY" -o StrictHostKeyChecking=no "$EC2" "
  PID=\$(pgrep -f 'standalone/server.js' | head -1)
  STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
  echo \"✓ 서버 실행 중 (PID: \$PID) HTTP \$STATUS\"
"

echo "✅ 배포 완료"
