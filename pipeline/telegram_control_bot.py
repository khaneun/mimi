"""
Mimi Telegram Control Bot
EC2 배포 환경에서 봇/서비스를 텔레그램으로 원격 제어

명령어:
  /start      — 시작 및 도움말
  /help       — 전체 명령어 목록
  /stop       — 봇 프로세스 중단
  /dashboard  — 대시보드 엔드포인트 조회
  /status     — 실행 중인 서비스 상태
  /deploy     — git pull + 서비스 재시작
  /restart    — 서비스 재시작 (dashboard / pipeline / bot)
  /logs       — 최근 로그 조회
  /instance   — EC2 인스턴스 정보

환경변수:
  TELEGRAM_BOT_TOKEN    — 봇 토큰 (필수)
  TELEGRAM_ADMIN_IDS    — 관리자 ID 목록 (쉼표 구분, 미설정 시 전체 허용)
  DASHBOARD_PORT        — 대시보드 포트 (기본: 3000)
  DASHBOARD_URL         — 커스텀 URL (미설정 시 EC2 퍼블릭 IP 자동 조회)
"""

import asyncio
import logging
import os
import signal
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

try:
    from utils.load_secrets import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

WORK_DIR = Path(__file__).parent.parent.resolve()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_IDS = [
    int(x.strip())
    for x in os.getenv("TELEGRAM_ADMIN_IDS", "").split(",")
    if x.strip().isdigit()
]
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", "3000"))
CUSTOM_DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")


# ------------------------------------------------------------------ #
# 유틸리티
# ------------------------------------------------------------------ #

def is_admin(user_id: int) -> bool:
    """관리자 여부 확인 (TELEGRAM_ADMIN_IDS 미설정 시 전체 허용)"""
    if not ADMIN_IDS:
        return True
    return user_id in ADMIN_IDS


def admin_only(func):
    """관리자 전용 데코레이터"""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_admin(update.effective_user.id):
            await update.message.reply_text("❌ 관리자 전용 명령어입니다.")
            logger.warning(f"Unauthorized access: user={update.effective_user.id}")
            return
        return await func(update, context)
    wrapper.__name__ = func.__name__
    return wrapper


def get_ec2_public_ip() -> str:
    """EC2 인스턴스 메타데이터에서 퍼블릭 IP 조회"""
    try:
        # IMDSv2 토큰 먼저 요청
        token_resp = requests.put(
            "http://169.254.169.254/latest/api/token",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
            timeout=2,
        )
        token = token_resp.text
        ip_resp = requests.get(
            "http://169.254.169.254/latest/meta-data/public-ipv4",
            headers={"X-aws-ec2-metadata-token": token},
            timeout=2,
        )
        return ip_resp.text.strip()
    except Exception:
        pass
    # IMDSv1 fallback
    try:
        return requests.get(
            "http://169.254.169.254/latest/meta-data/public-ipv4", timeout=2
        ).text.strip()
    except Exception:
        return ""


def get_ec2_instance_id() -> str:
    try:
        token_resp = requests.put(
            "http://169.254.169.254/latest/api/token",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
            timeout=2,
        )
        token = token_resp.text
        return requests.get(
            "http://169.254.169.254/latest/meta-data/instance-id",
            headers={"X-aws-ec2-metadata-token": token},
            timeout=2,
        ).text.strip()
    except Exception:
        return "N/A (로컬 환경)"


def get_ec2_instance_type() -> str:
    try:
        token_resp = requests.put(
            "http://169.254.169.254/latest/api/token",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"},
            timeout=2,
        )
        token = token_resp.text
        return requests.get(
            "http://169.254.169.254/latest/meta-data/instance-type",
            headers={"X-aws-ec2-metadata-token": token},
            timeout=2,
        ).text.strip()
    except Exception:
        return "N/A"


def run_shell(cmd: str, cwd: str = None, timeout: int = 60) -> tuple[int, str]:
    """쉘 명령 실행 후 (returncode, output) 반환"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd or str(WORK_DIR),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode, output
    except subprocess.TimeoutExpired:
        return -1, f"타임아웃 ({timeout}초 초과)"
    except Exception as e:
        return -1, str(e)


def get_service_pids(name: str) -> list[int]:
    """프로세스 이름으로 PID 목록 조회"""
    rc, out = run_shell(f"pgrep -f '{name}'", timeout=5)
    if rc == 0 and out:
        return [int(p) for p in out.split() if p.isdigit()]
    return []


# ------------------------------------------------------------------ #
# 명령어 핸들러
# ------------------------------------------------------------------ #

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *Mimi Control Bot*\n"
        "_Powered by Market Pulse_\n\n"
        "/help 으로 전체 명령어를 확인하세요.",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    admin_mark = " _(관리자)_" if ADMIN_IDS else ""
    text = (
        "📋 *Mimi Control Bot 명령어*\n\n"
        "🔵 *일반*\n"
        "  /start — 봇 시작\n"
        "  /help — 이 도움말\n"
        "  /dashboard — 대시보드 엔드포인트\n"
        "  /status — 서비스 상태\n"
        "  /instance — EC2 인스턴스 정보\n\n"
        f"🔴 *운영{admin_mark}*\n"
        "  /stop — 컨트롤 봇 중단\n"
        "  /deploy — git pull + 서비스 재시작\n"
        "  /restart `<service>` — 서비스 재시작\n"
        "    ㄴ `dashboard` / `pipeline` / `bot` / `all`\n"
        "  /logs `<service>` — 최근 로그 50줄\n"
        "    ㄴ `dashboard` / `pipeline` / `bot`\n"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


@admin_only
async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """컨트롤 봇 프로세스 종료"""
    await update.message.reply_text("🛑 컨트롤 봇을 중단합니다...")
    logger.info(f"Stop requested by user {update.effective_user.id}")
    os.kill(os.getpid(), signal.SIGTERM)


async def cmd_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """대시보드 엔드포인트 표시"""
    if CUSTOM_DASHBOARD_URL:
        url = CUSTOM_DASHBOARD_URL
        source = "설정값"
    else:
        ip = get_ec2_public_ip()
        if ip:
            url = f"http://{ip}:{DASHBOARD_PORT}"
            source = "EC2 퍼블릭 IP"
        else:
            url = f"http://localhost:{DASHBOARD_PORT}"
            source = "로컬 (EC2 IP 조회 실패)"

    # Next.js 대시보드 프로세스 확인
    pids = get_service_pids("next")
    running = "🟢 실행 중" if pids else "🔴 중단됨"

    text = (
        f"📊 *대시보드 정보*\n\n"
        f"🔗 *URL*: {url}\n"
        f"📡 *소스*: {source}\n"
        f"⚙️ *상태*: {running}\n"
        f"🕐 *조회 시각*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """실행 중인 서비스 상태 조회"""
    services = {
        "Next.js 대시보드":  "next",
        "파이프라인":         "pipeline",
        "컨트롤 봇":         "telegram_control_bot",
        "실시간 서버":        "realtime_server",
        "뉴스 크롤러":        "news_crawler",
    }

    lines = ["⚙️ *서비스 상태*\n"]
    for label, keyword in services.items():
        pids = get_service_pids(keyword)
        if pids:
            lines.append(f"🟢 {label} (PID: {', '.join(map(str, pids))})")
        else:
            lines.append(f"🔴 {label}")

    # 디스크 사용량
    rc, disk = run_shell("df -h / | tail -1 | awk '{print $3\"/\"$2\" (\"$5\" 사용)\"}'", timeout=5)
    # 메모리
    rc2, mem = run_shell("free -h | awk '/^Mem/ {print $3\"/\"$2}'", timeout=5)

    lines.append(f"\n💾 *디스크*: {disk}")
    lines.append(f"🧠 *메모리*: {mem}")
    lines.append(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


@admin_only
async def cmd_deploy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """git pull + 서비스 재시작"""
    await update.message.reply_text("🚀 배포 시작...\n`git pull` 실행 중", parse_mode="Markdown")
    logger.info(f"Deploy requested by user {update.effective_user.id}")

    # 1. git pull
    rc, out = run_shell("git pull origin main", timeout=60)
    if rc != 0:
        await update.message.reply_text(f"❌ git pull 실패:\n```\n{out[:800]}\n```", parse_mode="Markdown")
        return

    branch_rc, branch = run_shell("git log --oneline -3")
    await update.message.reply_text(
        f"✅ *git pull 완료*\n```\n{branch[:300]}\n```",
        parse_mode="Markdown",
    )

    # 2. Python 의존성 갱신
    await update.message.reply_text("📦 의존성 갱신 중...")
    rc2, out2 = run_shell("uv pip install -r requirements.txt -q", timeout=120)
    dep_msg = "✅ 의존성 갱신 완료" if rc2 == 0 else f"⚠️ 의존성 갱신 경고:\n```{out2[:400]}```"
    await update.message.reply_text(dep_msg, parse_mode="Markdown")

    # 3. 대시보드 재시작
    await update.message.reply_text("🔄 대시보드 재시작 중...")
    _restart_dashboard()

    await update.message.reply_text(
        "✅ *배포 완료*\n/status 로 서비스 상태를 확인하세요.",
        parse_mode="Markdown",
    )


@admin_only
async def cmd_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """서비스 재시작: /restart <dashboard|pipeline|bot|all>"""
    args = context.args
    if not args:
        await update.message.reply_text(
            "사용법: `/restart <service>`\n"
            "서비스: `dashboard` / `pipeline` / `bot` / `all`",
            parse_mode="Markdown",
        )
        return

    service = args[0].lower()
    await update.message.reply_text(f"🔄 `{service}` 재시작 중...", parse_mode="Markdown")
    logger.info(f"Restart [{service}] requested by user {update.effective_user.id}")

    results = []

    if service in ("dashboard", "all"):
        ok = _restart_dashboard()
        results.append(f"{'✅' if ok else '❌'} dashboard")

    if service in ("pipeline", "all"):
        ok = _restart_pipeline()
        results.append(f"{'✅' if ok else '❌'} pipeline")

    if service in ("bot", "all"):
        results.append("✅ bot (현재 봇은 재시작되지 않음, /stop 후 재실행 필요)")

    if not results:
        await update.message.reply_text(f"❓ 알 수 없는 서비스: `{service}`", parse_mode="Markdown")
        return

    await update.message.reply_text("\n".join(results), parse_mode="Markdown")


@admin_only
async def cmd_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """최근 로그 조회: /logs <dashboard|pipeline|bot>"""
    args = context.args
    service = args[0].lower() if args else "pipeline"

    log_paths = {
        "dashboard": WORK_DIR / "logs" / "dashboard.log",
        "pipeline":  sorted(
            (WORK_DIR / "logs").glob("pipeline_*.log"),
            key=lambda p: p.stat().st_mtime, reverse=True
        )[0] if list((WORK_DIR / "logs").glob("pipeline_*.log")) else None,
        "bot":       sorted(
            Path(".").glob("ai_bot_*.log"),
            key=lambda p: p.stat().st_mtime, reverse=True
        )[0] if list(Path(".").glob("ai_bot_*.log")) else None,
    }

    log_file = log_paths.get(service)
    if not log_file or not Path(log_file).exists():
        # fallback: 로그 디렉토리에서 최신 파일 검색
        log_dir = WORK_DIR / "logs"
        if log_dir.exists():
            files = sorted(log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
            log_file = files[0] if files else None

    if not log_file or not Path(log_file).exists():
        await update.message.reply_text(f"❌ `{service}` 로그 파일을 찾을 수 없습니다.", parse_mode="Markdown")
        return

    rc, tail = run_shell(f"tail -50 '{log_file}'", timeout=5)
    if not tail:
        tail = "(로그 없음)"

    # 4096자 제한
    if len(tail) > 3500:
        tail = "...(생략)...\n" + tail[-3200:]

    await update.message.reply_text(
        f"📄 *{service} 로그* (`{Path(log_file).name}`)\n```\n{tail}\n```",
        parse_mode="Markdown",
    )


async def cmd_instance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """EC2 인스턴스 정보 조회"""
    ip = get_ec2_public_ip()
    instance_id = get_ec2_instance_id()
    instance_type = get_ec2_instance_type()

    # git 정보
    _, git_branch = run_shell("git rev-parse --abbrev-ref HEAD", timeout=5)
    _, git_commit = run_shell("git log --oneline -1", timeout=5)
    _, uptime = run_shell("uptime -p", timeout=5)

    text = (
        "☁️ *EC2 인스턴스 정보*\n\n"
        f"🆔 *Instance ID*: `{instance_id}`\n"
        f"💻 *Type*: `{instance_type}`\n"
        f"🌐 *Public IP*: `{ip or 'N/A'}`\n"
        f"📊 *Dashboard*: `http://{ip}:{DASHBOARD_PORT}`\n\n"
        f"🌿 *Branch*: `{git_branch}`\n"
        f"📝 *Last commit*: `{git_commit[:60]}`\n"
        f"⏱️ *Uptime*: {uptime}\n"
        f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


# ------------------------------------------------------------------ #
# 서비스 재시작 헬퍼
# ------------------------------------------------------------------ #

def _restart_dashboard() -> bool:
    """Next.js 대시보드 재시작"""
    # 기존 프로세스 종료
    for pid in get_service_pids("next"):
        run_shell(f"kill {pid}", timeout=5)

    # 새로 시작 (백그라운드)
    dashboard_dir = WORK_DIR / "examples" / "dashboard"
    if not dashboard_dir.exists():
        logger.warning("Dashboard directory not found")
        return False

    rc, _ = run_shell(
        f"nohup npm run start > {WORK_DIR}/logs/dashboard.log 2>&1 &",
        cwd=str(dashboard_dir),
        timeout=10,
    )
    return rc == 0


def _restart_pipeline() -> bool:
    """파이프라인 프로세스 재시작"""
    for pid in get_service_pids("daily_pipeline"):
        run_shell(f"kill {pid}", timeout=5)
    for pid in get_service_pids("realtime_server"):
        run_shell(f"kill {pid}", timeout=5)

    rc, _ = run_shell(
        f"nohup bash {WORK_DIR}/scripts/realtime.sh > {WORK_DIR}/logs/realtime.log 2>&1 &",
        timeout=10,
    )
    return rc == 0


# ------------------------------------------------------------------ #
# 메인
# ------------------------------------------------------------------ #

def main():
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.")
        sys.exit(1)

    Path(WORK_DIR / "logs").mkdir(exist_ok=True)

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .build()
    )

    app.add_handler(CommandHandler("start",     cmd_start))
    app.add_handler(CommandHandler("help",      cmd_help))
    app.add_handler(CommandHandler("stop",      cmd_stop))
    app.add_handler(CommandHandler("dashboard", cmd_dashboard))
    app.add_handler(CommandHandler("status",    cmd_status))
    app.add_handler(CommandHandler("deploy",    cmd_deploy))
    app.add_handler(CommandHandler("restart",   cmd_restart))
    app.add_handler(CommandHandler("logs",      cmd_logs))
    app.add_handler(CommandHandler("instance",  cmd_instance))

    admin_info = f"관리자: {ADMIN_IDS}" if ADMIN_IDS else "관리자 제한 없음 (TELEGRAM_ADMIN_IDS 미설정)"
    logger.info(f"Mimi Control Bot 시작 — {admin_info}")

    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
