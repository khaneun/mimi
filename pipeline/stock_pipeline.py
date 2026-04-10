"""
Stock Pipeline — MarketPulse 종목 분석 파이프라인
mcp-agent 없이 Claude API 직접 호출로 종목 심층 분석
"""

import asyncio
import logging
import os
import time
from datetime import datetime
from pathlib import Path

from pykrx import stock as pykrx_stock

from cores.llm_client import LLMClient, get_llm_client
from cores.agent_runner import AgentTask, AgentRunner

logger = logging.getLogger(__name__)

# MarketPulse 에이전트 instruction (cores/agents/*.py에서 추출한 핵심 프롬프트)
TECHNICAL_ANALYST_PROMPT = """당신은 한국 주식시장 전문 기술적 분석가입니다.

주어진 OHLCV 데이터를 분석하여 다음을 포함한 기술적 분석 보고서를 작성하세요:

1. 주가 추세 분석 (단기/중기/장기 이동평균선)
2. RSI(14) 분석 — 과매수/과매도 판단
3. MACD(12,26,9) 분석 — 골든크로스/데드크로스
4. 볼린저밴드(20) 분석 — 밴드 위치, 밴드폭
5. 거래량 분석 — 가격-거래량 상관관계
6. 지지선/저항선 식별
7. 기술적 관점 향후 전망 (단기/중기)

3000자 이내로 한국어로 작성하세요."""

TRADING_FLOW_PROMPT = """당신은 한국 주식시장 투자자 거래 동향 분석 전문가입니다.

주어진 투자자별 거래 데이터를 분석하여 다음을 포함하세요:

1. 기관 투자자 동향 (순매수/순매도 추이)
2. 외국인 투자자 동향
3. 개인 투자자 동향
4. 투자자별 매매 패턴과 주가 상관관계
5. 수급 기반 향후 전망

3000자 이내로 한국어로 작성하세요."""

FINANCIAL_ANALYST_PROMPT = """당신은 기업 재무 분석 전문가입니다.

주어진 기업 정보와 재무 데이터를 분석하여 다음을 포함하세요:

1. 기업 개요 및 사업 구조
2. 주요 재무 지표 (EPS, BPS, PER, PBR, ROE)
3. 매출/영업이익 추이
4. 밸류에이션 평가
5. 동종 업종 비교
6. 재무적 관점 투자 의견

3000자 이내로 한국어로 작성하세요."""

NEWS_ANALYST_PROMPT = """당신은 주식시장 뉴스 분석 전문가입니다.

주어진 기업과 시장 정보를 바탕으로 다음을 분석하세요:

1. 최근 주요 뉴스/이벤트
2. 긍정적/부정적 촉매 요인
3. 섹터/산업 동향
4. 경쟁사 동향
5. 뉴스 기반 향후 주가 영향 전망

3000자 이내로 한국어로 작성하세요."""

MARKET_ANALYST_PROMPT = """당신은 한국 주식시장 매크로 분석 전문가입니다.

현재 시장 상황을 분석하여 다음을 포함하세요:

1. KOSPI/KOSDAQ 동향
2. 글로벌 시장 영향 (미국, 중국, 유럽)
3. 환율/금리/유가 동향
4. 외국인/기관 시장 전체 수급
5. 시장 전체 관점에서의 해당 종목 포지셔닝

3000자 이내로 한국어로 작성하세요."""

INVESTMENT_STRATEGIST_PROMPT = """당신은 투자 전략가입니다.

6명의 전문가(기술적 분석, 투자자 동향, 재무 분석, 뉴스 분석, 시장 분석, 산업 분석)의
분석 결과를 종합하여 최종 투자 보고서를 작성하세요.

포함 사항:
1. 핵심 요약 (Executive Summary)
2. 종합 투자 의견 (강력매수/매수/중립/매도/강력매도)
3. 목표가 및 손절가
4. 리스크 요인
5. 투자 전략 (진입/청산 시점)
6. 투자자 유형별 권고

5000자 이내로 한국어로 작성하세요."""


async def fetch_stock_data(code: str, days: int = 252) -> dict:
    """pykrx로 종목 데이터 프리페치"""
    from datetime import datetime, timedelta

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")

    logger.info(f"[데이터] {code} OHLCV 조회 ({start_date}~{end_date})")

    data = {}

    try:
        # OHLCV
        df_ohlcv = await asyncio.to_thread(
            pykrx_stock.get_market_ohlcv_by_date, start_date, end_date, code
        )
        if not df_ohlcv.empty:
            data["ohlcv"] = df_ohlcv.tail(30).to_string()
            data["ohlcv_full"] = df_ohlcv
            logger.info(f"[데이터] OHLCV {len(df_ohlcv)}일 조회 완료")
    except Exception as e:
        logger.warning(f"[데이터] OHLCV 조회 실패: {e}")
        data["ohlcv"] = "데이터 조회 실패"

    try:
        # 투자자별 거래
        df_trading = await asyncio.to_thread(
            pykrx_stock.get_market_trading_volume_by_date,
            start_date, end_date, code
        )
        if df_trading is not None and not df_trading.empty:
            data["trading"] = df_trading.tail(20).to_string()
            logger.info(f"[데이터] 투자자 거래 {len(df_trading)}일 조회 완료")
    except Exception as e:
        logger.warning(f"[데이터] 투자자 거래 조회 실패: {e}")
        data["trading"] = "데이터 조회 실패"

    try:
        # 펀더멘털
        df_fund = await asyncio.to_thread(
            pykrx_stock.get_market_fundamental, end_date, market="ALL"
        )
        if df_fund is not None and code in df_fund.index:
            fund = df_fund.loc[code]
            data["fundamental"] = fund.to_string()
    except Exception as e:
        logger.warning(f"[데이터] 펀더멘털 조회 실패: {e}")
        data["fundamental"] = "데이터 조회 실패"

    return data


async def analyze_stock(
    code: str,
    name: str,
    reference_date: str = None,
    language: str = "ko",
) -> str:
    """종목 심층 분석 — Claude 직접 호출"""

    start = time.time()
    logger.info(f"=== {name}({code}) 분석 시작 ===")

    # 1. 데이터 프리페치
    data = await fetch_stock_data(code)

    # 2. 분석 에이전트 태스크 구성
    analysis_tasks = [
        AgentTask(
            name="기술적_분석",
            system_prompt=TECHNICAL_ANALYST_PROMPT,
            user_message=f"종목: {name}({code})\n\n## OHLCV 데이터 (최근 30일)\n{data.get('ohlcv', '없음')}",
        ),
        AgentTask(
            name="투자자_동향",
            system_prompt=TRADING_FLOW_PROMPT,
            user_message=f"종목: {name}({code})\n\n## 투자자별 거래 데이터 (최근 20일)\n{data.get('trading', '없음')}",
        ),
        AgentTask(
            name="재무_분석",
            system_prompt=FINANCIAL_ANALYST_PROMPT,
            user_message=f"종목: {name}({code})\n\n## 펀더멘털 데이터\n{data.get('fundamental', '없음')}",
        ),
        AgentTask(
            name="뉴스_분석",
            system_prompt=NEWS_ANALYST_PROMPT,
            user_message=f"종목: {name}({code})\n최근 뉴스와 이벤트를 분석해주세요. 현재 날짜: {reference_date or datetime.now().strftime('%Y-%m-%d')}",
        ),
        AgentTask(
            name="시장_분석",
            system_prompt=MARKET_ANALYST_PROMPT,
            user_message=f"종목: {name}({code})\n현재 시장 상황에서 이 종목의 포지셔닝을 분석해주세요.",
        ),
    ]

    # 3. 5개 에이전트 병렬 실행
    runner = AgentRunner(max_concurrent=5)
    results = await runner.run_parallel(analysis_tasks)

    # 4. 종합 분석 (투자 전략가)
    sections = "\n\n".join([
        f"## {r.name}\n{r.content}" for r in results.values() if r.success
    ])

    strategy_task = AgentTask(
        name="투자_전략",
        system_prompt=INVESTMENT_STRATEGIST_PROMPT,
        user_message=f"# {name}({code}) 전문가 분석 결과\n\n{sections}",
        max_tokens=8192,
    )

    strategy_result = await runner._run_single(strategy_task)

    # 5. 최종 리포트 조합
    elapsed = time.time() - start
    report = f"""# {name} ({code}) 분석 보고서

**발행일:** {datetime.now().strftime('%Y.%m.%d %H:%M KST')}
**분석 소요:** {elapsed:.1f}초
**모델:** Claude Sonnet 4

---

{strategy_result.content if strategy_result.success else '전략 분석 실패'}

---

## 상세 분석

"""
    for r in results.values():
        if r.success:
            report += f"### {r.name} ({r.elapsed_seconds:.1f}초)\n\n{r.content}\n\n---\n\n"

    logger.info(f"=== {name}({code}) 분석 완료: {len(report)}자, {elapsed:.1f}초 ===")

    # 6. 파일 저장
    output_dir = Path("reports/stocks")
    output_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y%m%d")
    output_path = output_dir / f"{code}_{name}_{date_str}.md"
    output_path.write_text(report, encoding="utf-8")
    logger.info(f"리포트 저장: {output_path}")

    return report


# CLI 실행
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    import os
    from dotenv import load_dotenv
    load_dotenv()
    default_ticker = os.getenv("DEFAULT_TICKER", "")
    default_name = ""
    if default_ticker and ":" in default_ticker:
        default_ticker, default_name = default_ticker.split(":", 1)

    code = sys.argv[1] if len(sys.argv) > 1 else default_ticker
    name = sys.argv[2] if len(sys.argv) > 2 else default_name

    if not code:
        print("사용법: python -m pipeline.stock_pipeline <종목코드> [종목명]")
        print("또는 .env에 DEFAULT_TICKER=000660:SK하이닉스 설정")
        sys.exit(1)

    result = asyncio.run(analyze_stock(code, name))
    print(f"\n리포트 길이: {len(result)}자")
