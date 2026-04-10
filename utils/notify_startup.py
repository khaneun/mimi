#!/usr/bin/env python3
"""
Mimi Trader 기동 알림 — Telegram 발송

사용법:
  python3 utils/notify_startup.py [public_ip]

start.sh에서 서비스 기동 직후 자동 호출됨.
"""
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from utils.load_secrets import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")

try:
    import requests
except ImportError:
    print("[notify] requests 미설치 — 알림 스킵")
    sys.exit(0)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHANNEL = os.getenv("TELEGRAM_CHANNEL_ID", "")
PORT = os.getenv("DASHBOARD_PORT", "3000")

PUBLIC_IP = sys.argv[1] if len(sys.argv) > 1 else ""

if not TOKEN or not CHANNEL:
    print("[notify] TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID 미설정 — 스킵")
    sys.exit(0)

if not PUBLIC_IP:
    # EC2 퍼블릭 IP 자동 조회
    try:
        token_resp = requests.put(
            "http://169.254.169.254/latest/api/token",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "60"},
            timeout=2,
        )
        PUBLIC_IP = requests.get(
            "http://169.254.169.254/latest/meta-data/public-ipv4",
            headers={"X-aws-ec2-metadata-token": token_resp.text},
            timeout=2,
        ).text
    except Exception:
        try:
            import socket
            PUBLIC_IP = socket.gethostbyname(socket.gethostname())
        except Exception:
            PUBLIC_IP = "unknown"

now = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M:%S")
dashboard_url = f"http://{PUBLIC_IP}:{PORT}"

msg = (
    "🚀 <b>Mimi Trader 기동 완료</b>\n"
    "\n"
    f"📊 대시보드: <a href=\"{dashboard_url}\">{dashboard_url}</a>\n"
    f"⚡ KIS 실시간 서버: 실행중\n"
    f"🤖 LLM: {os.getenv('LLM_PROVIDER', 'openai').upper()}\n"
    f"⏰ {now} KST\n"
    "\n"
    f"<i>서버: {PUBLIC_IP}</i>"
)

try:
    resp = requests.post(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        json={"chat_id": CHANNEL, "text": msg, "parse_mode": "HTML"},
        timeout=10,
    )
    if resp.status_code == 200:
        print(f"[notify] 텔레그램 알림 발송 완료 → {CHANNEL}")
    else:
        print(f"[notify] 텔레그램 발송 실패 ({resp.status_code}): {resp.text[:100]}")
except Exception as e:
    print(f"[notify] 텔레그램 예외: {e}")
