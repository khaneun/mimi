"""
MarketPulse 실시간 시세 서버
한투 REST API로 현재가 조회 → 대시보드 JSON 갱신

KIS API 없이도 실행 가능 (KIS_ENABLED=false 시 실시간 시세 스킵)
"""
import asyncio
import json
import logging
import os
import time
import requests
import yaml
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "trading" / "config" / "kis_devlp.yaml"
DASHBOARD_JSON = Path(__file__).parent.parent / "examples" / "dashboard" / "public" / "dashboard_data.json"

# KIS API 활성화 여부 (환경변수 또는 config 파일 존재 여부로 판단)
KIS_ENABLED = os.getenv("KIS_ENABLED", "auto").lower()
if KIS_ENABLED == "auto":
    KIS_ENABLED = CONFIG_PATH.exists() or bool(os.getenv("KIS_APP_KEY"))


def _parse_watch_tickers() -> list[str]:
    """WATCH_TICKERS 환경변수 파싱 (형식: '000660:SK하이닉스,005930:삼성전자' 또는 '000660,005930')"""
    raw = os.getenv("WATCH_TICKERS", "")
    if not raw:
        return []
    tickers = []
    for item in raw.split(","):
        item = item.strip()
        if ":" in item:
            tickers.append(item.split(":")[0].strip())
        elif item:
            tickers.append(item)
    return tickers


WATCH_TICKERS = _parse_watch_tickers()


class KISClient:
    """한국투자증권 REST API 클라이언트

    인증 정보 우선순위:
      1. 환경변수 KIS_APP_KEY / KIS_APP_SECRET / KIS_MODE
      2. trading/config/kis_devlp.yaml
    """

    def __init__(self):
        # 환경변수 우선, 없으면 yaml fallback
        env_key = os.getenv("KIS_APP_KEY")
        env_sec = os.getenv("KIS_APP_SECRET")
        kis_mode = os.getenv("KIS_MODE", "paper").lower()  # paper(모의) or real(실전)

        if env_key and env_sec:
            self.app_key = env_key
            self.app_secret = env_sec
            self.base_url = (
                "https://openapivts.koreainvestment.com:29443"
                if kis_mode == "paper"
                else "https://openapi.koreainvestment.com:9443"
            )
            logger.info(f"KIS 인증: 환경변수 사용 (mode={kis_mode})")
        elif CONFIG_PATH.exists():
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            mode_key = 'paper_app' if kis_mode == "paper" else 'my_app'
            mode_sec = 'paper_sec' if kis_mode == "paper" else 'my_sec'
            self.app_key = config.get(mode_key) or config.get('my_app', '')
            self.app_secret = config.get(mode_sec) or config.get('my_sec', '')
            self.base_url = config.get('vps' if kis_mode == "paper" else 'prod',
                                       'https://openapi.koreainvestment.com:9443')
            logger.info(f"KIS 인증: kis_devlp.yaml 사용 (mode={kis_mode})")
        else:
            raise RuntimeError(
                "KIS API 인증 정보 없음. "
                "환경변수 KIS_APP_KEY/KIS_APP_SECRET을 설정하거나 "
                "trading/config/kis_devlp.yaml을 생성하세요."
            )

        self.token = None
        self.token_expires = 0
        self.token_file = Path(__file__).parent.parent / ".kis_token.json"
        self._load_cached_token()

    def _load_cached_token(self):
        """파일에서 캐싱된 토큰 로드"""
        try:
            if self.token_file.exists():
                with open(self.token_file, 'r') as f:
                    cached = json.load(f)
                if cached.get('expires', 0) > time.time():
                    self.token = cached['token']
                    self.token_expires = cached['expires']
                    logger.info("KIS 캐싱 토큰 로드 성공")
        except:
            pass

    def _save_token(self):
        """토큰을 파일에 캐싱"""
        try:
            with open(self.token_file, 'w') as f:
                json.dump({'token': self.token, 'expires': self.token_expires}, f)
        except:
            pass

    def _get_token(self):
        """접근 토큰 발급 (캐싱 우선, 1일 1회 갱신)"""
        if self.token and time.time() < self.token_expires:
            return self.token

        url = f"{self.base_url}/oauth2/tokenP"
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }
        try:
            resp = requests.post(url, json=body, timeout=10)
            data = resp.json()

            if 'access_token' in data:
                self.token = data['access_token']
                self.token_expires = time.time() + 86000  # ~24시간
                self._save_token()
                logger.info("KIS 토큰 신규 발급 성공")
                return self.token
            else:
                logger.error(f"토큰 발급 실패: {data.get('error_description', '')}")
                return self.token  # 기존 토큰이라도 반환
        except Exception as e:
            logger.error(f"토큰 발급 에러: {e}")
            return self.token

    def get_current_price(self, ticker: str) -> dict:
        """현재가 조회"""
        token = self._get_token()
        if not token:
            return {}

        url = f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-price"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": "FHKST01010100",
            "content-type": "application/json; charset=utf-8",
        }
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": ticker,
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()

            if data.get('rt_cd') == '0':
                output = data.get('output', {})
                return {
                    'ticker': ticker,
                    'price': int(output.get('stck_prpr', 0)),
                    'change': int(output.get('prdy_vrss', 0)),
                    'change_rate': float(output.get('prdy_ctrt', 0)),
                    'volume': int(output.get('acml_vol', 0)),
                    'high': int(output.get('stck_hgpr', 0)),
                    'low': int(output.get('stck_lwpr', 0)),
                    'open': int(output.get('stck_oprc', 0)),
                    'time': output.get('stck_cntg_hour', ''),
                }
            else:
                logger.warning(f"[{ticker}] 조회 실패: {data.get('msg1', '')}")
                return {}
        except Exception as e:
            logger.error(f"[{ticker}] API 에러: {e}")
            return {}

    def get_index_price(self, index_code: str = "0001") -> dict:
        """지수 현재가 (0001=KOSPI, 1001=KOSDAQ)"""
        token = self._get_token()
        if not token:
            return {}

        url = f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-index-price"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": "FHPUP02100000",
            "content-type": "application/json; charset=utf-8",
        }
        params = {
            "FID_COND_MRKT_DIV_CODE": "U",
            "FID_INPUT_ISCD": index_code,
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()
            if data.get('rt_cd') == '0':
                output = data.get('output', {})
                return {
                    'value': float(output.get('bstp_nmix_prpr', 0)),
                    'change': float(output.get('bstp_nmix_prdy_vrss', 0)),
                    'change_rate': float(output.get('bstp_nmix_prdy_ctrt', 0)),
                }
        except Exception as e:
            logger.error(f"지수 조회 에러: {e}")
        return {}


    def get_overseas_price(self, symbol: str, exchange: str = "NAS") -> dict:
        """해외 주식/지수/원자재 현재가 조회
        exchange: NAS=나스닥, NYS=뉴욕, AMS=아멕스, HKS=홍콩, SHS=상해, SZS=심천
        symbol: .DJI=다우, .SPX=S&P500, .IXIC=나스닥, .VIX=VIX
                 GCZ24=금선물, CLZ24=원유선물, SIZ24=은선물
        """
        token = self._get_token()
        if not token:
            return {}

        url = f"{self.base_url}/uapi/overseas-price/v1/quotations/price"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": "HHDFS00000300",
            "content-type": "application/json; charset=utf-8",
        }
        params = {
            "AUTH": "",
            "EXCD": exchange,
            "SYMB": symbol,
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()
            if data.get('rt_cd') == '0':
                output = data.get('output', {})
                price = float(output.get('last', 0) or output.get('stck_prpr', 0) or 0)
                change = float(output.get('diff', 0) or output.get('prdy_vrss', 0) or 0)
                change_rate = float(output.get('rate', 0) or output.get('prdy_ctrt', 0) or 0)
                return {
                    'value': price,
                    'change': change,
                    'change_rate': change_rate,
                }
            else:
                logger.warning(f"[{symbol}] 해외 조회 실패: {data.get('msg1', '')}")
        except Exception as e:
            logger.error(f"[{symbol}] 해외 API 에러: {e}")
        return {}

    def get_exchange_rate(self) -> dict:
        """원/달러 환율 조회"""
        token = self._get_token()
        if not token:
            return {}

        url = f"{self.base_url}/uapi/overseas-stock/v1/quotations/inquire-daily-chartprice"
        # 환율은 국내 지수에서 조회 가능한 경우도 있음. 대안으로 해외 시세 활용
        # FX_USDKRW 또는 달러인덱스로 대체
        try:
            # 달러/원은 직접 API가 제한적이므로 pykrx로 대체
            from pykrx import stock
            from datetime import datetime, timedelta
            end = datetime.now().strftime('%Y%m%d')
            start = (datetime.now() - timedelta(days=5)).strftime('%Y%m%d')
            # KODEX 달러선물 ETF로 환율 추정
            df = stock.get_market_ohlcv_by_date(start, end, '261240')
            if not df.empty:
                cur = float(df.iloc[-1]['종가'])
                prev = float(df.iloc[-2]['종가']) if len(df) > 1 else cur
                return {
                    'value': round(cur * 130, 0),  # ETF → 환율 환산 근사
                    'change': round((cur - prev) / prev * 100, 2),
                    'change_rate': round((cur - prev) / prev * 100, 2),
                }
        except:
            pass
        return {}


    def get_top_gainers(self, count: int = 5) -> list:
        """급등주 TOP N 조회"""
        token = self._get_token()
        if not token:
            return []

        url = f"{self.base_url}/uapi/domestic-stock/v1/ranking/fluctuation"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": "FHPST01700000",
            "content-type": "application/json; charset=utf-8",
        }
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_COND_SCR_DIV_CODE": "20170",
            "FID_INPUT_ISCD": "0000",
            "FID_RANK_SORT_CLS_CODE": "0",
            "FID_INPUT_CNT_1": "0",
            "FID_PRC_CLS_CODE": "0",
            "FID_INPUT_PRICE_1": "0",
            "FID_INPUT_PRICE_2": "0",
            "FID_VOL_CNT": "0",
            "FID_TRGT_CLS_CODE": "0",
            "FID_TRGT_EXLS_CLS_CODE": "0",
            "FID_DIV_CLS_CODE": "0",
            "FID_RSFL_RATE1": "",
            "FID_RSFL_RATE2": "",
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()
            if data.get('rt_cd') == '0':
                results = []
                for item in data.get('output', [])[:count]:
                    results.append({
                        'name': item.get('hts_kor_isnm', ''),
                        'code': item.get('stck_shrn_iscd', ''),
                        'price': int(item.get('stck_prpr', '0')),
                        'change_rate': float(item.get('prdy_ctrt', '0')),
                        'volume': int(item.get('acml_vol', '0')),
                    })
                return results
        except Exception as e:
            logger.error(f"급등주 조회 에러: {e}")
        return []


def update_dashboard(client: KISClient):
    """대시보드 JSON 갱신"""
    logger.info("=== 실시간 시세 갱신 ===")

    with open(DASHBOARD_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 종목 현재가 갱신
    for h in data.get('holdings', []):
        price_data = client.get_current_price(h['ticker'])
        if price_data.get('price'):
            h['current_price'] = price_data['price']
            h['change'] = price_data.get('change', 0)
            h['change_rate'] = price_data.get('change_rate', 0)
            h['last_updated'] = datetime.now().isoformat()
            logger.info(f"  {h['name']}: {price_data['price']:,}원 ({price_data.get('change_rate', 0):+.2f}%)")
        time.sleep(0.2)  # API rate limit

    # 금현물 수동 가격 (KRX 금시장은 한투 API 미지원)
    GOLD_PRICE_PER_GRAM = 227340
    price_cache = {'GOLD': {'price': GOLD_PRICE_PER_GRAM, 'change': 0, 'change_rate': 0}}
    logger.info(f"  금현물: {GOLD_PRICE_PER_GRAM:,}원/g (수동)")

    # holding_decisions(AI 보유 분석) 갱신
    for h in data.get('holdings', []):
        if h.get('current_price'):
            price_cache[h['ticker']] = {'price': h['current_price'], 'change': h.get('change', 0), 'change_rate': h.get('change_rate', 0)}

    for hd in data.get('holding_decisions', []):
        if hd['ticker'] in price_cache:
            hd['current_price'] = price_cache[hd['ticker']]['price']
            hd['change_rate'] = price_cache[hd['ticker']]['change_rate']
        else:
            price_data = client.get_current_price(hd['ticker'])
            if price_data.get('price'):
                hd['current_price'] = price_data['price']
                hd['change_rate'] = price_data.get('change_rate', 0)
                price_cache[hd['ticker']] = price_data
                time.sleep(0.2)

    # watchlist 갱신
    for w in data.get('watchlist', []):
        if w['ticker'] in price_cache:
            w['current_price'] = price_cache[w['ticker']]['price']
            w['change'] = price_cache[w['ticker']].get('change', 0)
            w['change_rate'] = price_cache[w['ticker']].get('change_rate', 0)
        else:
            price_data = client.get_current_price(w['ticker'])
            if price_data.get('price'):
                w['current_price'] = price_data['price']
                w['change'] = price_data.get('change', 0)
                w['change_rate'] = price_data.get('change_rate', 0)
                price_cache[w['ticker']] = price_data
            time.sleep(0.2)
        logger.info(f"  {w['name']}: {w['current_price']:,}원")

    # 포트폴리오 종목 현재가 조회
    portfolio_path = DASHBOARD_JSON.parent / 'portfolio_data.json'
    if portfolio_path.exists():
        try:
            with open(portfolio_path, 'r', encoding='utf-8') as f:
                pf = json.load(f)
            portfolio_prices = {}
            for acc in pf.get('accounts', []):
                for stock in acc.get('stocks', []):
                    code = stock.get('code', '')
                    if code and code not in price_cache and code != 'GOLD':
                        pd = client.get_current_price(code)
                        if pd.get('price'):
                            price_cache[code] = pd
                            portfolio_prices[code] = pd['price']
                            logger.info(f"  [포트] {stock['name']}: {pd['price']:,}원")
                        time.sleep(0.2)
            # holdings에 포트폴리오 종목 추가 (없는 것만)
            existing_tickers = {h['ticker'] for h in data.get('holdings', [])}
            existing_watch = {w['ticker'] for w in data.get('watchlist', [])}
            for acc in pf.get('accounts', []):
                for stock in acc.get('stocks', []):
                    code = stock.get('code', '')
                    if code in price_cache and code not in existing_tickers and code not in existing_watch:
                        data.setdefault('watchlist', []).append({
                            'id': code, 'ticker': code, 'name': stock['name'],
                            'company_name': stock['name'],
                            'current_price': price_cache[code]['price'],
                            'change': price_cache[code].get('change', 0),
                            'change_rate': price_cache[code].get('change_rate', 0),
                            'sector': '', 'score': 0, 'decision': '',
                            'analyzed_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
                        })
        except Exception as e:
            logger.warning(f"  포트폴리오 조회 실패: {e}")

    # KOSPI/KOSDAQ 지수
    kospi = client.get_index_price("0001")
    kosdaq = client.get_index_price("1001")
    if kospi.get('value'):
        logger.info(f"  KOSPI: {kospi['value']:,.2f} ({kospi.get('change_rate', 0):+.2f}%)")
    if kosdaq.get('value'):
        logger.info(f"  KOSDAQ: {kosdaq['value']:,.2f} ({kosdaq.get('change_rate', 0):+.2f}%)")

    # 해외 지수/원자재 조회
    overseas = {}
    overseas_items = [
        ('S&P 500', 'SPY', 'AMS'),      # S&P 500 ETF
        ('NASDAQ', 'QQQ', 'NAS'),        # Nasdaq ETF
        ('Gold', 'GLD', 'AMS'),           # Gold ETF
        ('WTI', 'USO', 'AMS'),            # Oil ETF
        ('Silver', 'SLV', 'AMS'),         # Silver ETF
    ]
    for name, symbol, exchange in overseas_items:
        try:
            result = client.get_overseas_price(symbol, exchange)
            if result.get('value'):
                overseas[name] = result
                logger.info(f"  {name}: {result['value']:,.2f} ({result.get('change_rate', 0):+.2f}%)")
            time.sleep(0.3)
        except Exception as e:
            logger.warning(f"  {name} 조회 실패: {e}")

    # 환율 (pykrx KODEX 미국달러선물 ETF / 10 ≈ 원/달러)
    try:
        from pykrx import stock as pykrx_stock
        from datetime import timedelta
        end = datetime.now().strftime('%Y%m%d')
        start = (datetime.now() - timedelta(days=5)).strftime('%Y%m%d')
        df = pykrx_stock.get_market_ohlcv_by_date(start, end, '261240')
        if not df.empty:
            cur = float(df.iloc[-1]['종가'])
            prev = float(df.iloc[-2]['종가']) if len(df) > 1 else cur
            chg_rate = round((cur - prev) / prev * 100, 2)
            estimated_rate = round(cur / 10, 0)  # ETF ÷ 10 = 환율
            overseas['USD/KRW'] = {'value': estimated_rate, 'change': chg_rate, 'change_rate': chg_rate}
            logger.info(f"  USD/KRW: {estimated_rate:,.0f}원 ({chg_rate:+.2f}%)")
    except Exception as e:
        logger.warning(f"  환율 조회 실패: {e}")

    # 급등주 TOP 5
    top_gainers = client.get_top_gainers(5)
    if top_gainers:
        logger.info(f"  급등주 TOP 5:")
        for g in top_gainers:
            logger.info(f"    {g['name']}: {g['price']:,}원 (+{g['change_rate']}%)")
    time.sleep(0.3)

    data['generated_at'] = datetime.now().isoformat()
    data['top_gainers'] = top_gainers
    data['realtime'] = {
        'kospi': kospi,
        'kosdaq': kosdaq,
        'overseas': overseas,
        'updated_at': datetime.now().strftime('%H:%M:%S'),
    }

    with open(DASHBOARD_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(DASHBOARD_JSON.parent / 'dashboard_data_en.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"=== 갱신 완료 ({datetime.now().strftime('%H:%M:%S')}) ===")


def run_realtime(interval_sec: int = 60):
    """주기적 실시간 갱신 (KIS_ENABLED=false 시 스킵)"""
    if not KIS_ENABLED:
        logger.warning(
            "KIS API 비활성화 상태 — 실시간 시세 갱신 스킵. "
            "KIS_APP_KEY/KIS_APP_SECRET 또는 kis_devlp.yaml 설정 후 재시작하세요."
        )
        return

    try:
        client = KISClient()
    except RuntimeError as e:
        logger.error(f"KISClient 초기화 실패: {e}")
        return

    logger.info(f"MarketPulse 실시간 서버 시작 (갱신 주기: {interval_sec}초)")
    while True:
        try:
            update_dashboard(client)
        except Exception as e:
            logger.error(f"갱신 에러: {e}")
        time.sleep(interval_sec)


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "loop"
    if mode == "once":
        if not KIS_ENABLED:
            logger.warning("KIS_ENABLED=false — 실시간 시세 기능 비활성화")
        else:
            try:
                client = KISClient()
                update_dashboard(client)
            except RuntimeError as e:
                logger.error(str(e))
    else:
        interval = int(mode) if mode.isdigit() else 60
        run_realtime(interval)
