#!/usr/bin/env python3
"""
KIS 포트폴리오 동기화 스크립트
한국투자증권 계좌 잔고를 조회하여 portfolio_data.json을 업데이트합니다.

사용법:
  python scripts/sync_portfolio.py [--mode paper|real]
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from utils.load_secrets import load_env

load_env()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# portfolio_data.json 출력 경로
PORTFOLIO_JSON = ROOT / "examples" / "dashboard" / "public" / "portfolio_data.json"

# 섹터 매핑 (코드 → 섹터명)
SECTOR_MAP: dict[str, str] = {
    "000660": "반도체",
    "005930": "반도체",
    "000990": "반도체장비",
    "042700": "반도체",
    "005380": "자동차",
    "012330": "자동차부품",
    "010130": "자동차부품",
    "373220": "에너지",
    "009830": "에너지",
    "329180": "방산",
    "272210": "방산",
    "035420": "인터넷",
    "035720": "인터넷",
    "105560": "금융",
    "055550": "금융",
    "003550": "지주ETF",
    "460790": "방산ETF",
    "441680": "로봇ETF",
    "381170": "방산ETF",
    "448290": "중공업ETF",
    "453330": "금ETF",
    "411060": "채권ETF",
    "143850": "해외ETF",
    "069500": "해외ETF",
    "102110": "채권ETF",
    "411060": "채권ETF",
}


def get_sector(code: str, name: str) -> str:
    """종목코드 또는 종목명으로 섹터 추론"""
    if code in SECTOR_MAP:
        return SECTOR_MAP[code]
    name_lower = name.lower() if name else ""
    if "etf" in name_lower or "ETF" in name:
        if "방산" in name:
            return "방산ETF"
        if "로봇" in name:
            return "로봇ETF"
        if "금" in name and "골드" not in name:
            return "금ETF"
        if "채권" in name or "국채" in name:
            return "채권ETF"
        if "중공업" in name or "조선" in name:
            return "중공업ETF"
        return "해외ETF"
    if "반도체" in name:
        return "반도체"
    if "자동차" in name:
        return "자동차"
    if "현대" in name:
        return "자동차"
    if "삼성" in name:
        return "반도체"
    return "기타"


def fetch_portfolio(mode: str) -> dict:
    """KIS API에서 포트폴리오 조회"""
    try:
        from trading.domestic_stock_trading import DomesticStockTrading

        # paper → demo, real → real
        kis_mode = "demo" if mode in ("paper", "demo") else "real"
        logger.info(f"KIS 포트폴리오 조회 시작 (mode={mode}, kis_mode={kis_mode})")

        trader = DomesticStockTrading(mode=kis_mode)
        holdings = trader.get_portfolio()
        summary = trader.get_account_summary()

        stocks = []
        for h in holdings:
            code = h.get("stock_code", "")
            name = h.get("stock_name", "")
            stocks.append({
                "name": name,
                "code": code,
                "quantity": int(h.get("quantity", 0)),
                "avg_price": int(h.get("avg_price", 0)),
                "current_price": int(h.get("current_price", 0)),
                "eval_amount": int(h.get("eval_amount", 0)),
                "profit_amount": int(h.get("profit_amount", 0)),
                "profit_rate": round(float(h.get("profit_rate", 0)), 2),
                "sector": get_sector(code, name),
            })

        account_number = trader.account_key if hasattr(trader, "account_key") else ""
        mode_label = "모의투자" if mode in ("paper", "demo") else "실전투자"
        account_name = f"한국투자증권"

        return {
            "success": True,
            "mode": mode,
            "account_name": account_name,
            "account_number": account_number,
            "mode_label": mode_label,
            "stocks": stocks,
            "summary": summary or {},
        }

    except Exception as e:
        logger.error(f"KIS 포트폴리오 조회 실패: {e}")
        return {
            "success": False,
            "mode": mode,
            "error": str(e),
            "stocks": [],
            "summary": {},
        }


def sync(mode: str | None = None) -> bool:
    """포트폴리오 동기화 실행"""
    if mode is None:
        mode = os.getenv("KIS_MODE", "paper")

    result = fetch_portfolio(mode)

    if not result["success"]:
        logger.error(f"동기화 실패: {result.get('error')}")
        return False

    # 기존 portfolio_data.json 로드 (없으면 빈 구조)
    if PORTFOLIO_JSON.exists():
        try:
            with open(PORTFOLIO_JSON) as f:
                existing = json.load(f)
        except Exception:
            existing = {"accounts": []}
    else:
        existing = {"accounts": []}

    # 단일 계좌 구조로 업데이트
    updated = {
        "accounts": [
            {
                "name": result["account_name"],
                "type": "KIS",
                "mode": result["mode"],
                "mode_label": result["mode_label"],
                "account_number": result["account_number"],
                "stocks": result["stocks"],
                "summary": result["summary"],
            }
        ],
        "synced_at": __import__("datetime").datetime.now().isoformat(),
        "kis_mode": mode,
    }

    PORTFOLIO_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(PORTFOLIO_JSON, "w", encoding="utf-8") as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)

    logger.info(f"portfolio_data.json 업데이트 완료 ({len(result['stocks'])}종목, mode={mode})")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["paper", "real"], default=None)
    args = parser.parse_args()

    ok = sync(args.mode)
    sys.exit(0 if ok else 1)
