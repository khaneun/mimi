#!/usr/bin/env python3
"""
MarketPulse 데이터 검증 스크립트

dashboard_data.json과 portfolio_data.json의 데이터 품질을 검증합니다.

실행: python3 scripts/validate_data.py
성공 시 exit 0, 실패 시 exit 1 + 에러 메시지
"""

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DASHBOARD_PATH = BASE_DIR / "examples" / "dashboard" / "public" / "dashboard_data.json"
PORTFOLIO_PATH = BASE_DIR / "examples" / "dashboard" / "public" / "portfolio_data.json"

def _load_known_tickers() -> dict:
    """WATCH_TICKERS 또는 SNAPSHOT_TICKERS 환경변수에서 알려진 티커 로드"""
    result = {}
    for env_key in ("WATCH_TICKERS", "SNAPSHOT_TICKERS"):
        raw = os.getenv(env_key, "")
        for item in raw.split(","):
            item = item.strip()
            if ":" in item:
                code, name = item.split(":", 1)
                result[code.strip()] = name.strip()
    return result


# 주요 티커-종목명 매핑 (검증용) — 환경변수에서 동적 로드
KNOWN_TICKERS = _load_known_tickers()

# 종목 코드: 6자리 숫자 또는 ETF/원자재 코드 (영문+숫자 조합)
CODE_PATTERN = re.compile(r"^(\d{6}|[A-Z0-9]{4,6}|[A-Za-z0-9]{6})$")


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_dashboard(data: dict) -> list[str]:
    errors: list[str] = []

    # --- holdings 검증 ---
    holdings = data.get("holdings", [])
    holding_tickers: set[str] = set()

    for i, h in enumerate(holdings):
        ticker = h.get("ticker", "")
        name = h.get("company_name") or h.get("name", f"holdings[{i}]")
        prefix = f"holdings[{i}] ({ticker} {name})"

        # current_price > 0
        cp = h.get("current_price", 0)
        if not cp or cp <= 0:
            errors.append(f"{prefix}: current_price가 0 이하입니다 ({cp})")

        # sector 존재
        if not h.get("sector"):
            errors.append(f"{prefix}: sector가 없습니다")

        # 종목 코드 형식 (6자리 숫자)
        if ticker and not CODE_PATTERN.match(ticker):
            errors.append(f"{prefix}: 종목 코드가 6자리 숫자가 아닙니다 ({ticker})")

        # 티커-종목명 매핑 검증
        if ticker in KNOWN_TICKERS:
            expected = KNOWN_TICKERS[ticker]
            actual = h.get("company_name") or h.get("name", "")
            if expected not in actual and actual not in expected:
                errors.append(
                    f"{prefix}: 종목명 불일치 (기대: {expected}, 실제: {actual})"
                )

        holding_tickers.add(ticker)

    # --- watchlist 검증 ---
    watchlist = data.get("watchlist", [])
    watchlist_tickers: set[str] = set()

    for i, w in enumerate(watchlist):
        ticker = w.get("ticker") or w.get("id", "")
        name = w.get("company_name") or w.get("name", f"watchlist[{i}]")
        prefix = f"watchlist[{i}] ({ticker} {name})"

        # buy_score > 0
        bs = w.get("buy_score", 0)
        if not bs or bs <= 0:
            errors.append(f"{prefix}: buy_score가 0 이하입니다 ({bs})")

        # target_price > 0
        tp = w.get("target_price", 0)
        if not tp or tp <= 0:
            errors.append(f"{prefix}: target_price가 0 이하입니다 ({tp})")

        # stop_loss > 0
        sl = w.get("stop_loss", 0)
        if not sl or sl <= 0:
            errors.append(f"{prefix}: stop_loss가 0 이하입니다 ({sl})")

        # sector 존재
        if not w.get("sector"):
            errors.append(f"{prefix}: sector가 없습니다")

        # 종목 코드 형식
        if ticker and not CODE_PATTERN.match(ticker):
            errors.append(f"{prefix}: 종목 코드가 6자리 숫자가 아닙니다 ({ticker})")

        watchlist_tickers.add(ticker)

    # --- holdings와 watchlist 중복 검사 ---
    duplicates = holding_tickers & watchlist_tickers
    if duplicates:
        for dup in sorted(duplicates):
            errors.append(f"중복: 티커 {dup}가 holdings와 watchlist 모두에 존재합니다")

    return errors


def validate_portfolio(data: dict) -> list[str]:
    errors: list[str] = []

    accounts = data.get("accounts", [])
    for ai, account in enumerate(accounts):
        acc_name = account.get("name", f"accounts[{ai}]")
        stocks = account.get("stocks", [])

        for si, stock in enumerate(stocks):
            code = stock.get("code", "")
            name = stock.get("name", f"stocks[{si}]")
            prefix = f"portfolio {acc_name} / {name} ({code})"

            # sector 존재
            if not stock.get("sector"):
                errors.append(f"{prefix}: sector가 없습니다")

            # 종목 코드 형식 (6자리 숫자)
            if code and not CODE_PATTERN.match(code):
                errors.append(f"{prefix}: 종목 코드가 6자리 숫자가 아닙니다 ({code})")

            # 티커-종목명 매핑 검증
            if code in KNOWN_TICKERS:
                expected = KNOWN_TICKERS[code]
                if expected not in name and name not in expected:
                    errors.append(
                        f"{prefix}: 종목명 불일치 (기대: {expected}, 실제: {name})"
                    )

    return errors


def validate_freshness(data: dict) -> list[str]:
    """데이터 최신성 검증 — 날짜가 오늘 또는 최근 거래일인지"""
    errors: list[str] = []
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    # 주말 고려: 금요일 데이터면 월요일에도 OK (최대 3일 전)
    three_days_ago = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")

    # generated_at 체크
    gen_at = data.get("generated_at", "")[:10]
    if gen_at and gen_at < three_days_ago:
        errors.append(f"generated_at이 3일 이상 오래됨: {gen_at} (오늘: {today})")

    # holdings last_updated 체크
    for h in data.get("holdings", []):
        updated = (h.get("last_updated") or "")[:10]
        if updated and updated < three_days_ago:
            errors.append(f"holdings {h.get('company_name','')}: last_updated {updated} (3일+ 경과)")

    # holding_decisions date 체크
    for hd in data.get("holding_decisions", []):
        dec_date = hd.get("decision_date", "")
        if dec_date and dec_date < three_days_ago:
            errors.append(f"decisions {hd.get('company_name','')}: decision_date {dec_date} (3일+ 경과)")

    # watchlist analyzed_date 체크 (샘플 5개만)
    stale_watch = 0
    for w in data.get("watchlist", []):
        analyzed = (w.get("analyzed_date") or "")[:10]
        if analyzed and analyzed < three_days_ago:
            stale_watch += 1
    if stale_watch > len(data.get("watchlist", [])) // 2:
        errors.append(f"watchlist {stale_watch}종목의 분석 날짜가 3일+ 경과")

    return errors


def validate_price_accuracy(data: dict) -> list[str]:
    """pykrx 실시간 가격과 ±5% 이내인지 검증 (선택적 — pykrx 없으면 스킵)"""
    errors: list[str] = []
    try:
        from pykrx import stock as pykrx_stock
        end = datetime.now().strftime('%Y%m%d')
        start = (datetime.now() - timedelta(days=7)).strftime('%Y%m%d')

        # 환경변수에서 샘플 종목 로드 (최대 3개)
        known = _load_known_tickers()
        samples = [(code, name) for code, name in list(known.items())[:3]]
        if not samples:
            return errors  # 설정된 종목 없으면 스킵
        holdings_map = {h["ticker"]: h["current_price"] for h in data.get("holdings", [])}

        for code, name in samples:
            dash_price = holdings_map.get(code, 0)
            if dash_price <= 0:
                continue
            try:
                df = pykrx_stock.get_market_ohlcv_by_date(start, end, code)
                if df.empty:
                    continue
                real_price = int(df.iloc[-1]["종가"])
                diff_pct = abs(dash_price - real_price) / real_price * 100 if real_price > 0 else 0
                if diff_pct > 5:
                    errors.append(f"{name}({code}): 대시보드 {dash_price:,} vs pykrx {real_price:,} ({diff_pct:.1f}% 차이)")
            except:
                pass
    except ImportError:
        pass  # pykrx 없으면 스킵

    return errors


def main() -> int:
    all_errors: list[str] = []

    # dashboard_data.json 검증
    if not DASHBOARD_PATH.exists():
        all_errors.append(f"파일 없음: {DASHBOARD_PATH}")
    else:
        dashboard = load_json(DASHBOARD_PATH)
        all_errors.extend(validate_dashboard(dashboard))
        all_errors.extend(validate_freshness(dashboard))
        all_errors.extend(validate_price_accuracy(dashboard))

    # portfolio_data.json 검증
    if not PORTFOLIO_PATH.exists():
        all_errors.append(f"파일 없음: {PORTFOLIO_PATH}")
    else:
        portfolio = load_json(PORTFOLIO_PATH)
        all_errors.extend(validate_portfolio(portfolio))

    if all_errors:
        print(f"[FAIL] 데이터 검증 실패 ({len(all_errors)}건)")
        for err in all_errors:
            print(f"  - {err}")
        return 1
    else:
        print("[OK] 데이터 검증 통과")
        return 0


if __name__ == "__main__":
    sys.exit(main())
