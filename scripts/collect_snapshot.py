#!/usr/bin/env python3
"""
MarketPulse Data Snapshot Collector
단일 시점에서 모든 시장 데이터를 수집하여 snapshot.json 생성.
모든 Harness 에이전트가 이 파일만 참조하여 데이터 정합성 보장.
"""
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")


def _parse_snapshot_tickers() -> dict[str, str]:
    """SNAPSHOT_TICKERS 환경변수 파싱 (형식: '000660:SK하이닉스,005930:삼성전자')"""
    raw = os.getenv("SNAPSHOT_TICKERS", "")
    result = {}
    for item in raw.split(","):
        item = item.strip()
        if ":" in item:
            code, name = item.split(":", 1)
            result[name.strip()] = code.strip()
    return result

SNAPSHOT_PATH = Path(__file__).parent.parent / "reports" / ".harness_state" / "snapshot.json"
DASHBOARD_PATH = Path(__file__).parent.parent / "examples" / "dashboard" / "public" / "dashboard_data.json"
PORTFOLIO_PATH = Path(__file__).parent.parent / "examples" / "dashboard" / "public" / "portfolio_data.json"


def collect_pykrx():
    """pykrx에서 주요 지수/종목 가격 수집"""
    from pykrx import stock as pykrx_stock

    end = datetime.now().strftime('%Y%m%d')
    start = (datetime.now() - timedelta(days=7)).strftime('%Y%m%d')

    data = {}

    # 주요 지수
    indices = {
        "KOSPI": "1001",  # KOSPI
        "KOSDAQ": "2001",  # KOSDAQ
    }
    for name, code in indices.items():
        try:
            df = pykrx_stock.get_index_ohlcv_by_date(start, end, code)
            if not df.empty:
                last = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else last
                data[name] = {
                    "value": float(last['종가']),
                    "change": float(last['종가'] - prev['종가']),
                    "change_rate": round(float((last['종가'] - prev['종가']) / prev['종가'] * 100), 2),
                    "date": df.index[-1].strftime('%Y-%m-%d'),
                }
        except Exception as e:
            print(f"  ⚠️ {name}: {e}")

    # 주요 종목/ETF — SNAPSHOT_TICKERS 환경변수에서 로드
    tickers = _parse_snapshot_tickers()
    if not tickers:
        print("  ⚠️ SNAPSHOT_TICKERS 환경변수 미설정 — 종목 스냅샷 스킵")
        print("  .env에 SNAPSHOT_TICKERS=000660:SK하이닉스,005930:삼성전자 형식으로 설정하세요.")
    stocks = {}
    for name, code in tickers.items():
        try:
            df = pykrx_stock.get_market_ohlcv_by_date(start, end, code)
            if not df.empty:
                last = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else last
                stocks[code] = {
                    "name": name,
                    "price": int(last['종가']),
                    "change": int(last['종가'] - prev['종가']),
                    "change_rate": round(float((last['종가'] - prev['종가']) / prev['종가'] * 100), 2),
                    "high_5d": int(df['고가'].max()),
                    "low_5d": int(df['저가'].min()),
                    "volume": int(last['거래량']),
                }
                print(f"  ✅ {name:14s} {int(last['종가']):>10,}")
        except Exception as e:
            print(f"  ⚠️ {name}: {e}")

    data["stocks"] = stocks

    # KOSPI/KOSDAQ가 없으면 dashboard_data에서 가져오기
    try:
        with open(DASHBOARD_PATH) as f:
            dd = json.load(f)
        rt = dd.get("realtime", {})
        if "KOSPI" not in data and rt.get("kospi", {}).get("value"):
            data["KOSPI"] = {
                "value": rt["kospi"]["value"],
                "change": rt["kospi"].get("change", 0),
                "change_rate": rt["kospi"].get("change_rate", 0),
                "date": dd.get("generated_at", "")[:10],
            }
        if "KOSDAQ" not in data and rt.get("kosdaq", {}).get("value"):
            data["KOSDAQ"] = {
                "value": rt["kosdaq"]["value"],
                "change": rt["kosdaq"].get("change", 0),
                "change_rate": rt["kosdaq"].get("change_rate", 0),
                "date": dd.get("generated_at", "")[:10],
            }
    except:
        pass

    return data


def collect_dashboard():
    """기존 dashboard_data.json에서 해외 지수/원자재 수집"""
    try:
        with open(DASHBOARD_PATH) as f:
            d = json.load(f)

        overseas = {}
        rt = d.get("realtime", {}).get("overseas", {})
        etf_convert = {
            "S&P 500": {"multiplier": 10, "prefix": "$"},
            "NASDAQ": {"multiplier": 37.8, "prefix": ""},
            "Gold": {"multiplier": 10.9, "prefix": "$"},
            "WTI": {"multiplier": 0.81, "prefix": "$"},
            "Silver": {"multiplier": 1.12, "prefix": "$"},
            "USD/KRW": {"multiplier": 1, "prefix": ""},
        }
        for name, info in rt.items():
            if info and info.get("value"):
                conv = etf_convert.get(name, {"multiplier": 1})
                overseas[name] = {
                    "value": round(info["value"] * conv["multiplier"]),
                    "etf_value": info["value"],
                    "change_rate": info.get("change_rate", 0),
                }

        return overseas
    except:
        return {}


def collect_portfolio():
    """포트폴리오 데이터 수집"""
    try:
        with open(PORTFOLIO_PATH) as f:
            p = json.load(f)

        holdings = []
        for acc in p.get("accounts", []):
            for s in acc.get("stocks", []):
                holdings.append({
                    "name": s["name"],
                    "code": s["code"],
                    "quantity": s["quantity"],
                    "avg_price": s["avg_price"],
                    "sector": s.get("sector", ""),
                })
        return holdings
    except:
        return []


def main():
    print("=== MarketPulse Data Snapshot ===")
    print(f"시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S KST')}")
    print()

    os.makedirs(SNAPSHOT_PATH.parent, exist_ok=True)

    # 1. pykrx 데이터
    print("[1/3] pykrx 수집...")
    pykrx_data = collect_pykrx()

    # 2. 해외 지수/원자재
    print("\n[2/3] 해외 지수 수집...")
    overseas = collect_dashboard()
    for name, info in overseas.items():
        print(f"  ✅ {name:12s} {info['value']:>10,}")

    # 3. 포트폴리오
    print("\n[3/3] 포트폴리오 수집...")
    portfolio = collect_portfolio()
    print(f"  {len(portfolio)}종목")

    # 스냅샷 생성
    snapshot = {
        "collected_at": datetime.now().isoformat(),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "note": "이 파일은 단일 시점 데이터입니다. 모든 리포트는 이 데이터만 참조하세요.",
        "indices": {k: v for k, v in pykrx_data.items() if k != "stocks"},
        "overseas": overseas,
        "stocks": pykrx_data.get("stocks", {}),
        "portfolio": portfolio,
    }

    with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 스냅샷 저장: {SNAPSHOT_PATH}")
    print(f"   크기: {os.path.getsize(SNAPSHOT_PATH):,} bytes")


if __name__ == "__main__":
    main()
