"""
Daily Pipeline — 통합 일일 분석 파이프라인
Investment Alpha 매크로 + MarketPulse 종목 분석 + 아카이브
"""

import asyncio
import logging
import time
import subprocess
from datetime import datetime
from pathlib import Path

from pipeline.macro_pipeline import run_macro_analysis
from pipeline.stock_pipeline import analyze_stock

logger = logging.getLogger(__name__)

DASHBOARD_PUBLIC = Path(__file__).parent.parent / "examples" / "dashboard" / "public"

REPORTS_DIR = Path(__file__).parent.parent / "reports"


async def run_daily(
    date: str = None,
    stocks: list[tuple[str, str]] = None,
    skip_macro: bool = False,
    skip_stocks: bool = False,
    skip_html: bool = False,
):
    """일일 통합 파이프라인

    Args:
        date: 분석 기준일 (기본: 오늘)
        stocks: 분석할 종목 리스트 [(코드, 이름), ...]
        skip_macro: 매크로 분석 건너뛰기
        skip_stocks: 종목 분석 건너뛰기
        skip_html: HTML 생성 건너뛰기
    """
    date = date or datetime.now().strftime("%Y년 %m월 %d일")
    start = time.time()

    logger.info("=" * 60)
    logger.info(f"MarketPulse 일일 파이프라인 시작 ({date})")
    logger.info("=" * 60)

    results = {"macro": {}, "stocks": {}}

    # Phase 1: 매크로 분석 (Investment Alpha 팀)
    if not skip_macro:
        logger.info("\n--- Phase 1: 매크로 분석 (4인 전문가 + 종합) ---")
        try:
            results["macro"] = await run_macro_analysis(date)
            logger.info(f"매크로 리포트 {len(results['macro'])}개 생성 완료")
        except Exception as e:
            logger.error(f"매크로 분석 실패: {e}")

    # Phase 2: 종목 분석 (MarketPulse 에이전트)
    if not skip_stocks and stocks:
        logger.info(f"\n--- Phase 2: 종목 분석 ({len(stocks)}개) ---")
        for code, name in stocks:
            try:
                report = await analyze_stock(code, name)
                results["stocks"][code] = {
                    "name": name,
                    "report_length": len(report),
                }
                logger.info(f"[{name}] 분석 완료: {len(report)}자")
            except Exception as e:
                logger.error(f"[{name}] 분석 실패: {e}")

    # Phase 3: HTML 생성
    if not skip_html:
        logger.info("\n--- Phase 3: HTML 생성 ---")
        try:
            macro_dir = REPORTS_DIR / "macro"
            for md_file in macro_dir.glob("*.md"):
                html_file = md_file.with_suffix(".html")
                subprocess.run(
                    ["pandoc", str(md_file), "-o", str(html_file),
                     "--standalone", "--metadata", f"title={md_file.stem}"],
                    capture_output=True, timeout=30,
                )
            logger.info("HTML 생성 완료")
        except Exception as e:
            logger.warning(f"HTML 생성 실패: {e}")

    # Phase 4: 아카이브
    logger.info("\n--- Phase 4: 아카이브 ---")
    date_str = datetime.now().strftime("%Y-%m-%d")
    archive_dir = REPORTS_DIR / "archive" / date_str
    archive_dir.mkdir(parents=True, exist_ok=True)

    # 매크로 리포트 아카이브
    macro_dir = REPORTS_DIR / "macro"
    for f in macro_dir.glob("*.md"):
        (archive_dir / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
    for f in macro_dir.glob("*.html"):
        if f.exists():
            (archive_dir / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")

    # 종목 리포트 아카이브
    stocks_dir = REPORTS_DIR / "stocks"
    for f in stocks_dir.glob(f"*_{date_str.replace('-', '')}*.md"):
        (archive_dir / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")

    logger.info(f"아카이브 저장: {archive_dir}")

    # Phase 5: MarketPulse 대시보드 데이터 갱신
    logger.info("\n--- Phase 5: MarketPulse 대시보드 갱신 ---")

    # 5-1: 실시간 시세 (KIS API → dashboard_data.json)
    try:
        from pipeline.realtime_server import update_dashboard, KISClient
        client = KISClient()
        update_dashboard(client)
        logger.info("실시간 시세 갱신 완료")
    except Exception as e:
        logger.warning(f"실시간 시세 갱신 실패: {e}")

    # 5-2: 뉴스 크롤링 (RSS + YouTube → news_data.json)
    try:
        from pipeline.news_crawler import crawl_and_analyze
        await crawl_and_analyze()
        logger.info("뉴스 크롤링 완료")
    except Exception as e:
        logger.warning(f"뉴스 크롤링 실패: {e}")

    # 5-3: 보유+관심종목 통합 분석 (Investment Alpha 팀 기반)
    try:
        from pipeline.watchlist_analyzer import run_analysis
        await run_analysis()
        logger.info("보유+관심종목 분석 완료 (Investment Alpha)")
    except Exception as e:
        logger.warning(f"보유+관심종목 분석 실패: {e}")

    # 5-4: HTML 리포트를 대시보드 public 디렉토리에 복사
    try:
        dashboard_reports = DASHBOARD_PUBLIC / "reports" / "macro"
        dashboard_reports.mkdir(parents=True, exist_ok=True)
        macro_dir = REPORTS_DIR / "macro"
        import shutil
        for html_file in macro_dir.glob("*.html"):
            shutil.copy2(str(html_file), str(dashboard_reports / html_file.name))
        logger.info("대시보드 리포트 복사 완료")
    except Exception as e:
        logger.warning(f"대시보드 리포트 복사 실패: {e}")

    # 완료
    elapsed = time.time() - start
    logger.info("\n" + "=" * 60)
    logger.info(f"일일 파이프라인 완료: {elapsed:.1f}초 ({elapsed/60:.1f}분)")
    logger.info(f"  매크로 리포트: {len(results['macro'])}개")
    logger.info(f"  종목 리포트: {len(results['stocks'])}개")
    logger.info("=" * 60)

    return results


# 포트폴리오에서 종목 자동 로드
def load_portfolio_stocks() -> list[tuple[str, str]]:
    """portfolio_data.json에서 보유 종목 추출 (ETF/특수코드 제외)"""
    portfolio_path = Path(__file__).parent.parent / "examples" / "dashboard" / "public" / "portfolio_data.json"
    try:
        import json
        with open(portfolio_path) as f:
            p = json.load(f)
        stocks = []
        seen = set()
        for acc in p.get('accounts', []):
            for s in acc.get('stocks', []):
                code = s.get('code', '')
                if code and code not in seen and code.isdigit() and len(code) == 6:
                    stocks.append((code, s['name']))
                    seen.add(code)
        return stocks
    except Exception:
        # .env WATCH_TICKERS 폴백 (형식: 000660:SK하이닉스,005930:삼성전자)
        import os
        raw = os.getenv("WATCH_TICKERS", "")
        if raw:
            result = []
            for item in raw.split(","):
                item = item.strip()
                if ":" in item:
                    code, name = item.split(":", 1)
                    result.append((code.strip(), name.strip()))
            if result:
                return result
        return []


# CLI 실행
if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    portfolio_stocks = load_portfolio_stocks()

    if mode == "macro":
        asyncio.run(run_daily(skip_stocks=True))
    elif mode == "stocks":
        asyncio.run(run_daily(skip_macro=True, stocks=portfolio_stocks))
    elif mode == "all":
        asyncio.run(run_daily(stocks=portfolio_stocks))
    else:
        print("Usage: python -m pipeline.daily_pipeline [macro|stocks|all]")
