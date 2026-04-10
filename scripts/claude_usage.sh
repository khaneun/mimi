#!/bin/bash
# Claude Code 사용량 수집 → JSON 출력
# 대시보드에서 fetch하여 표시

CLAUDE="${HOME}/.local/bin/claude"
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/examples/dashboard/public"

# 현재 모델
MODEL=$("$CLAUDE" -p "/model" --output-format text 2>/dev/null | head -1 || echo "claude-sonnet-4-6")

# 구독 타입
PLAN="Max"

# 세션 통계 (최근 트랜스크립트에서 추출)
TRANSCRIPT_DIR="${HOME}/.claude"
SESSION_COUNT=$(ls "$TRANSCRIPT_DIR"/projects/*/sessions/ 2>/dev/null | wc -l | tr -d ' ')
TODAY=$(date +%Y-%m-%d)

# JSON 출력
cat > "${OUTPUT_DIR}/claude_usage.json" << JSONEOF
{
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "plan": "${PLAN}",
  "model": "${MODEL}",
  "session_count": ${SESSION_COUNT},
  "date": "${TODAY}",
  "status": "active",
  "features": {
    "agents": 11,
    "e2e_tests": 25,
    "pipelines": 9,
    "components": 23
  }
}
JSONEOF

echo "claude_usage.json updated"
