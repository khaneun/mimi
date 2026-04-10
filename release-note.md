# Mimi Release Notes

> **Powered by Market Pulse**
> AI 기반 주식 분석 + 투자 대시보드 플랫폼

---

## v1.1.0 (2026-04-10)

v1.0.0 이후 인프라·설정 전면 개편. 다중 LLM 지원, KIS 설정 분리, AWS 보안 강화, EC2 자동 배포 기반을 확립했습니다.

---

### 다중 LLM 프로바이더 지원

`LLM_PROVIDER` 환경변수 하나로 AI 엔진 전환 가능. 코드 변경 없음.

| 프로바이더 | 설정값 | 비고 |
|-----------|--------|------|
| Claude Code CLI | `claude-cli` | 현재 로그인 계정 토큰 사용 (기본) |
| Anthropic API | `anthropic` | `ANTHROPIC_API_KEY` 필요 |
| OpenAI ChatGPT | `openai` | `OPENAI_API_KEY` 필요 |
| Google Gemini | `gemini` | `GEMINI_API_KEY` 필요 |

- `cores/llm_client.py` 완전 재작성 — 단일 `LLMClient` 클래스로 4개 백엔드 통합
- Claude CLI 타임아웃 120s → 600s 상향 (병렬 에이전트 안정성 개선)
- `google-genai>=1.0.0` 신규 패키지로 교체 (구버전 `google-generativeai` 제거)

---

### KIS API 설정 분리 및 .env 통합

모의투자/실전투자 인증 정보를 별도 환경변수로 분리.

```
KIS_PAPER_APP_KEY / KIS_PAPER_APP_SECRET / KIS_PAPER_ACCOUNT  ← 모의투자
KIS_REAL_APP_KEY  / KIS_REAL_APP_SECRET  / KIS_REAL_ACCOUNT   ← 실전투자
```

- `trading/config/kis_devlp.yaml` 없이 `.env`만으로 완전 운용 가능
- 환경변수가 yaml보다 항상 우선 적용 (EC2/Docker 배포 친화)
- yaml은 다중 계좌(`accounts` 리스트) 운용 시에만 선택 사용
- `domestic_stock_trading.py`, `portfolio_telegram_reporter.py`: yaml 직접 오픈 제거 → `ka._cfg` 재사용

---

### AWS Secrets Manager 연동

API 키·비밀번호·토큰을 코드/파일에서 완전 분리.

| 항목 | 내용 |
|------|------|
| 시크릿 이름 | `mimi/production` (14개 키) |
| 저장 항목 | KRX/KIS/Telegram/Anthropic/OpenAI/Gemini 자격증명 |
| EC2 접근 | `mimi-trader-role` IAM 역할 (SecretsManagerReadPolicy) |
| 로컬 개발 | `.env.local` 파일 (git 제외) |

- `utils/load_secrets.py` 신규: Secrets Manager → os.environ 자동 로더
  - boto3 없거나 IAM 권한 없으면 `.env` fallback (로컬 개발 무중단)
  - 기존 env var는 덮어쓰지 않음 (명시적 설정 최우선)
- `.env`: 시크릿 제거, 비민감 설정값만 유지
- `.env.local.example`: 로컬 개발용 시크릿 템플릿 추가
- `realtime_server.py`, `telegram_control_bot.py`, `collect_snapshot.py`: `load_env()` 연결

---

### Telegram 제어 봇 (`pipeline/telegram_control_bot.py`)

EC2 원격 관리 명령어 지원.

| 명령어 | 설명 | 권한 |
|--------|------|------|
| `/start`, `/help` | 도움말 | 전체 |
| `/dashboard` | 대시보드 공개 URL 조회 | 전체 |
| `/status` | 서비스 상태 확인 | 전체 |
| `/instance` | EC2 인스턴스 정보 | 전체 |
| `/stop` | 봇 중단 | 관리자 |
| `/deploy` | git pull + 재배포 | 관리자 |
| `/restart <svc>` | 서비스 재시작 | 관리자 |
| `/logs <svc>` | 최근 로그 조회 | 관리자 |

- `TELEGRAM_ADMIN_IDS` 환경변수로 관리자 제한
- EC2 IMDSv2로 퍼블릭 IP 자동 조회

---

### EC2 자동 배포 인프라

- **인스턴스**: `mimi-trader` (t3.small, ap-northeast-2, 20GB gp3)
- **보안그룹**: `mimi-trader-sg` (22/3000/8080 개방)
- **IAM 역할**: `mimi-trader-role` (Secrets Manager 읽기 전용)
- `scripts/start.sh`: 서비스 기동 통합 스크립트
  - `all` / `dashboard` / `realtime` / `stop` / `status` 명령 지원
  - 기동 완료 후 Telegram으로 퍼블릭 URL 자동 알림
- `utils/notify_startup.py`: 기동 알림 유틸 (대시보드 URL + KST 시간)
- rsync 기반 배포 (`.git`, `.venv`, `node_modules` 제외)

---

### 기타 개선

- `scripts/daily_run.sh`: 하드코딩된 Mac 절대경로 → 동적 `WORK_DIR` 변수
- `requirements.txt`: `mcp-agent` PyPI 공식 패키지로 교체 (삭제된 git repo 참조 제거)
- `KIS_DEFAULT_UNIT_AMOUNT_USD` 환경변수 추가 (미국 주식 기본 매수 금액)

---

## v1.0.0 (2026-04-10)

첫 번째 정식 릴리즈입니다. 한국/미국 주식 시장 분석, 자동 매매, 실시간 대시보드를 통합한 AI 투자 플랫폼의 전체 기능이 포함됩니다.

---

### 핵심 아키텍처

- **AI 에이전트 팀**: Investment Alpha 6인 + MarketPulse 분석 6종 + 지원 에이전트 다수
- **실행 기반**: Claude Code CLI (`claude -p`) — API 직접 호출 없음
- **동시 실행**: 병렬 최대 2개 에이전트, Dependency Graph 지원
- **Harness 설계**: Planner → Generator → Evaluator → Deploy 4단계 파이프라인

---

### 기능 목록

#### 1. AI 에이전트 시스템

**Investment Alpha 팀 (6인)**

| 에이전트 | 역할 | 출력 |
|---------|------|------|
| Chief Analyst | 4개 리포트 종합, 투자자 유형별 포트폴리오 전략 | `final_investment_report.md` |
| Macro Economist | 글로벌 거시경제 (Fed, 인플레이션, GDP, 고용) | `macro_economy_report.md` |
| Commodity Analyst | 금/은 원자재, Gold-Silver Ratio, 산업 수요 | `commodity_report.md` |
| Stock Analyst | 한국/미국 주식, AI·반도체·빅테크 섹터, 추천 30종 | `stock_market_report.md` |
| Real Estate Analyst | 한국 부동산, GTX 수혜 지역, REITs | `real_estate_report.md` |
| Monthly Reporter | 월별 종합 성과, 행동 패턴 진단, 승률/알파 분석 | `monthly_report_YYYY-MM.md` |

**MarketPulse 종목 분석 에이전트 (6종, 순차 실행)**

1. 기술분석 — OHLCV, 이동평균, 추세
2. 수급분석 — 기관/외국인/개인 투자자별 거래
3. 재무분석 — EPS, BPS, ROE, PER, PBR
4. 산업분석 — 섹터 포지션, 경쟁사 비교
5. 뉴스분석 — 키워드 감정, 리스크 감지
6. 시장분석 — KOSPI/KOSDAQ 지수 맥락

**지원 에이전트**

- 매수 전문가 — 신규 진입 점수 산정 (80점 이상 매수)
- 매도 전문가 — 목표가/손절가 도달 시 판단
- 텔레그램 요약 — 4096자 제한 자동 분할 최적화
- 번역 에이전트 — 한국어 ↔ 영어 다국어 변환
- 메모리 압축 — 오래된 기록 LLM 토큰 효율 압축

---

#### 2. 파이프라인

**일일 통합 파이프라인** (`pipeline/daily_pipeline.py`, 평일 21:00 자동 실행)
- 거시경제 분석 (Investment Alpha 팀 순차 실행)
- 종목 심층 분석 (6단계 에이전트)
- HTML 리포트 생성 (pandoc)
- 대시보드 JSON 데이터 갱신
- 리포트 일별 아카이브

**실시간 서버** (`pipeline/realtime_server.py`)
- 1분 주기: KIS API 현재가 조회 + 대시보드 갱신
- 5분 주기: RSS 뉴스 수집

**뉴스 크롤링** (`pipeline/news_crawler.py`)
- RSS 7개 매체: 매일경제, 한국경제, 한경글로벌마켓, 연합뉴스, 조선비즈, Investing.com 등
- YouTube RSS 5개 채널: 슈카월드, 삼프로TV, 소수몽키, 체슬리TV, 머니두
- Claude Code CLI 기반 키워드/감정/종목 맵핑 자동 분석

**트리거 배치** (`trigger_batch.py`)
- 오전 급등/모멘텀 종목 자동 감지
- 후보 종목 JSON 생성 → 분석 파이프라인 연결

**Harness 4단계 파이프라인**
- Phase 0: 단일 시점 데이터 스냅샷
- Phase 1: Planner — 스프린트 계약 작성
- Phase 2: Generator — 병렬 에이전트 실행 (최대 2개)
- Phase 3: Evaluator — 품질 평가 + FAIL 시 재작업 (최대 2회)
- Phase 4: Deploy — 최종 리포트 배포

---

#### 3. Next.js 대시보드

**경로**: `examples/dashboard/` (Next.js 16 + React 19 + TypeScript + Tailwind CSS)

**8개 탭**

| 탭 | 기능 |
|----|------|
| Dashboard | 보유종목 테이블, 수익률 차트, 핵심 지표 카드 |
| AI Decisions | 매수/매도 추천 이력, 근거, 신뢰도 점수 |
| Trading | 매매 완전 로그, 수익/손실, 보유기간 |
| Watchlist | 추적 종목, 목표가, 손절가, 결정 사유 |
| Insights | 주간/월간 성과, 섹터별 알파, 행동 패턴 |
| Portfolio | 섹터 비중 시각화, 자산 배분, 리밸런싱 제안 |
| News | 실시간 뉴스 RSS, YouTube 영상, 감정도 분석 |
| Reports | 매크로/종목 리포트 열람 및 다운로드 |

**추가 탭**
- **Jeoningu Lab** — 전인구 역발상 시뮬레이션 성과 (KR 전용)

**주요 기능**
- 한국어/영어 다국어 전환 (`language-provider.tsx`)
- KR/US 시장 선택 (`market-selector.tsx`)
- 1분 실시간 현재가 갱신
- 미니 캔들 차트 (`holdings-table.tsx`)
- 23개 UI 컴포넌트

---

#### 4. 자동 매매 시스템 (KIS API)

**한국투자증권 API 연동** (`trading/domestic_stock_trading.py`)
- 개발(demo)/실전(prod) 모드 전환
- OAuth2 토큰 자동 발급 + 1일 캐싱
- 현재가 조회, 잔액/보유종목 조회
- 매수/매도 주문 실행, 체결가 조회
- `aiohttp` 기반 비동기 처리

**미국 주식** (`prism-us/`)
- KIS 해외주식 API 연동
- 독립 분석 오케스트레이터
- US 전용 대시보드 JSON 생성

**매매 기록 관리** (SQLite)

| 테이블 | 내용 |
|--------|------|
| `stock_holdings` | 보유종목, 매수가, 목표가, 손절가 |
| `trading_history` | 매매 이력, 수익률, 보유기간 |
| `watchlist_history` | 관심종목 분석 기록, 투자 시나리오 |

**매매 전략**
- 트리거 배치 급등/모멘텀 감지 → 6단계 분석 평가
- 점수 80점 이상 시 매수 실행
- 목표가 도달 자동 익절 / 손절가 이하 자동 손절
- 섹터별 비중 제한 + 리밸런싱 추천

---

#### 5. 텔레그램 알림

- 매수/매도 신호 즉시 알림 (근거 + 목표가 + 손절가 포함)
- 일일 포트폴리오 상태 리포트
- 뉴스 헤드라인 + YouTube 요약
- 전인구 이벤트 신규 영상 감지 알림
- 한국어/영어 자동 번역 발송
- 4096자 초과 시 자동 분할

---

#### 6. 이벤트 추적 — Jeoningu Lab

- YouTube RSS 모니터링, 신규 영상 자동 감지
- Whisper API 자막 변환
- GPT 시장 감정 분석
- 역발상 전략 (인버스/레버리지 ETF) 시뮬레이션
- SQLite 매매 시뮬레이션 + 성과 추적
- 텔레그램 브로드캐스트

---

#### 7. 데이터 수집

**한국 주식** (pykrx + KRX)
- OHLCV, 투자자별 거래량, 기업정보
- EPS, BPS, ROE, PER, PBR, 배당금

**미국 주식** (yfinance)
- OHLCV, S&P500/Nasdaq/Dow 지수, 환율

**거시경제** (WebSearch)
- Fed/ECB/BOJ/BOK 금리 정책
- CPI, PCE, PPI, GDP, 고용지표, 달러 인덱스

**원자재**
- 금/은 현물가, 중앙은행 보유량, 광산주
- WTI/Brent 원유, 구리, 리튬, 곡물

**부동산** (한국)
- 서울/수도권/지방 매매·전세 시세
- GTX, 신도시, 재건축, 상업용 부동산, REITs

**병렬 수집** (`cores/data_prefetch.py`)
- asyncio + Semaphore(4) 동시 수집
- NaN/None/빈 문자열 자동 처리 (`_safe_float`, `_safe_int`)

---

#### 8. 테스트

**E2E 테스트 26개** (Playwright, `examples/dashboard/e2e/dashboard.spec.ts`)
- 8개 탭 전체 페이지 로드 + 에러 수집 + 성능
- 데이터 구조 검증 (필드 타입, 값 범위)
- NaN/undefined 렌더링 방지
- 링크 유효성, 가격 일관성

**Python 테스트 20+개** (`tests/`)
- 비동기 매매, JSON 파싱, KRX API, 매매일지, 포트폴리오 리포트

---

#### 9. 부가 기능

- **PDF 변환** — Playwright(Chromium) + pdfkit + pandoc 지원
- **Firebase 푸시 알림** — 모바일 앱 연동 (선택적)
- **Redis / GCP Pub/Sub** — 실시간 신호 전파, 분산 확장 (선택적)
- **다국어 리포트** — 한국어(합쇼체) 기본, 영어 자동 번역
- **차트 생성** (`cores/stock_chart.py`) — 기술적 분석 차트

---

### 기술 스택

| 영역 | 기술 |
|------|------|
| AI/LLM | Claude Code CLI (Anthropic) |
| 백엔드 | Python 3.11+, aiohttp, aiosqlite |
| 프론트엔드 | Next.js 16, React 19, TypeScript, Tailwind CSS |
| 주식 데이터 | pykrx, yfinance, KIS API |
| 데이터베이스 | SQLite |
| 메시징 | Telegram Bot, Redis, GCP Pub/Sub, Firebase |
| 테스트 | Playwright E2E |
| 자동화 | Crontab, Shell scripts |
| 문서 생성 | Pandoc, Playwright, pdfkit |
| 뉴스 수집 | feedparser, yt-dlp, Whisper API |

---

### 프로젝트 규모

- Python 파일: 50+개
- Next.js 컴포넌트: 23개
- AI 에이전트: 12+개
- E2E 테스트: 26개
- Python 테스트: 20+개
- 데이터베이스 테이블: 6개+
- 종목 맵핑: `stock_map.json` (전 종목)

---

*Mimi — Powered by Market Pulse*
