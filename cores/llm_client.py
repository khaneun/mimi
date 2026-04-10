"""
LLM Client — 멀티 프로바이더 지원
- claude-cli  : Claude Code CLI (`claude -p`) — 현재 로그인 계정 토큰 사용
- anthropic   : Anthropic Claude API (ANTHROPIC_API_KEY)
- openai      : OpenAI ChatGPT API (OPENAI_API_KEY)
- gemini      : Google Gemini API (GEMINI_API_KEY)

환경변수 LLM_PROVIDER로 선택 (기본값: claude-cli)
"""

import asyncio
import os
import logging
import json
import subprocess
from typing import Optional

from json_repair import repair_json

logger = logging.getLogger(__name__)

# 프로바이더별 기본 모델
PROVIDER_DEFAULTS = {
    "claude-cli": "claude-sonnet-4-20250514",
    "anthropic":  "claude-sonnet-4-20250514",
    "openai":     "gpt-4o",
    "gemini":     "gemini-2.0-flash",
}

DEFAULT_MODEL = PROVIDER_DEFAULTS["claude-cli"]
FAST_MODEL = "claude-haiku-4-20250414"


class LLMClient:
    """멀티 프로바이더 LLM 클라이언트

    환경변수:
        LLM_PROVIDER     : claude-cli | anthropic | openai | gemini  (기본: claude-cli)
        ANTHROPIC_API_KEY: Anthropic Claude API 키
        ANTHROPIC_MODEL  : 모델 오버라이드 (기본: claude-sonnet-4-20250514)
        OPENAI_API_KEY   : OpenAI API 키
        OPENAI_MODEL     : 모델 오버라이드 (기본: gpt-4o)
        GEMINI_API_KEY   : Google Gemini API 키
        GEMINI_MODEL     : 모델 오버라이드 (기본: gemini-2.0-flash)
    """

    def __init__(
        self,
        model: str = None,
        max_tokens: int = 8192,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
    ):
        self.provider = (provider or os.getenv("LLM_PROVIDER", "claude-cli")).lower()
        self.max_tokens = max_tokens
        self._api_key = api_key
        self._client = None

        # 모델: 명시 지정 > 환경변수 > 프로바이더 기본값
        if model:
            self.model = model
        elif self.provider == "openai":
            self.model = os.getenv("OPENAI_MODEL", PROVIDER_DEFAULTS["openai"])
        elif self.provider == "gemini":
            self.model = os.getenv("GEMINI_MODEL", PROVIDER_DEFAULTS["gemini"])
        elif self.provider == "anthropic":
            self.model = os.getenv("ANTHROPIC_MODEL", PROVIDER_DEFAULTS["anthropic"])
        else:
            self.model = DEFAULT_MODEL

        # Claude CLI 경로 (claude-cli 모드 전용)
        local_path = os.path.expanduser("~/.local/bin/claude")
        self.claude_path = local_path if os.path.exists(local_path) else "claude"

        self._init_client()

    # ------------------------------------------------------------------ #
    # 초기화
    # ------------------------------------------------------------------ #

    def _init_client(self):
        if self.provider == "anthropic":
            try:
                import anthropic
                key = self._api_key or os.getenv("ANTHROPIC_API_KEY")
                if not key:
                    raise ValueError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
                self._client = anthropic.Anthropic(api_key=key)
                logger.info(f"[LLM] Anthropic API 준비 (모델: {self.model})")
            except ImportError:
                raise ImportError("anthropic 패키지 필요: pip install anthropic")

        elif self.provider == "openai":
            try:
                import openai
                key = self._api_key or os.getenv("OPENAI_API_KEY")
                if not key:
                    raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
                self._client = openai.OpenAI(api_key=key)
                logger.info(f"[LLM] OpenAI API 준비 (모델: {self.model})")
            except ImportError:
                raise ImportError("openai 패키지 필요: pip install openai")

        elif self.provider == "gemini":
            try:
                from google import genai
                key = self._api_key or os.getenv("GEMINI_API_KEY")
                if not key:
                    raise ValueError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
                self._client = genai.Client(api_key=key)
                logger.info(f"[LLM] Google Gemini API 준비 (모델: {self.model})")
            except ImportError:
                raise ImportError("google-genai 패키지 필요: pip install google-genai")

        else:  # claude-cli (기본)
            logger.info(f"[LLM] Claude Code CLI 모드 (경로: {self.claude_path})")

    # ------------------------------------------------------------------ #
    # 프로바이더별 동기 호출
    # ------------------------------------------------------------------ #

    def _call_claude_cli(self, system_prompt: str, user_message: str) -> str:
        """Claude Code CLI subprocess — 현재 로그인 계정 토큰 사용"""
        prompt = f"{system_prompt}\n\n{user_message}"
        try:
            result = subprocess.run(
                [self.claude_path, "-p", prompt, "--output-format", "text"],
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode != 0:
                logger.error(f"claude CLI 실패 (rc={result.returncode}): {result.stderr[:200]}")
                return ""
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            logger.error("claude CLI 타임아웃 (600초)")
            return ""
        except FileNotFoundError:
            logger.error(f"claude CLI를 찾을 수 없음: {self.claude_path}")
            return ""
        except Exception as e:
            logger.error(f"claude CLI 에러: {e}")
            return ""

    def _call_anthropic(self, system_prompt: str, user_message: str) -> str:
        """Anthropic Claude API 직접 호출"""
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Anthropic API 에러: {e}")
            return ""

    def _call_openai(self, system_prompt: str, user_message: str) -> str:
        """OpenAI ChatGPT API 호출"""
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI API 에러: {e}")
            return ""

    def _call_gemini(self, system_prompt: str, user_message: str) -> str:
        """Google Gemini API 호출"""
        try:
            from google.genai import types
            prompt = f"{system_prompt}\n\n{user_message}"
            response = self._client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(max_output_tokens=self.max_tokens),
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini API 에러: {e}")
            return ""

    # ------------------------------------------------------------------ #
    # 공통 인터페이스
    # ------------------------------------------------------------------ #

    def generate_sync(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """동기 호출 (프로바이더 자동 선택)"""
        if self.provider == "anthropic":
            return self._call_anthropic(system_prompt, user_message)
        elif self.provider == "openai":
            return self._call_openai(system_prompt, user_message)
        elif self.provider == "gemini":
            return self._call_gemini(system_prompt, user_message)
        else:
            return self._call_claude_cli(system_prompt, user_message)

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """비동기 호출"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate_sync(system_prompt, user_message, model, max_tokens, temperature),
        )

    async def generate_with_retry(
        self,
        system_prompt: str,
        user_message: str,
        max_retries: int = 2,
        **kwargs,
    ) -> str:
        """재시도 포함 비동기 호출"""
        for attempt in range(max_retries + 1):
            result = await self.generate(system_prompt, user_message, **kwargs)
            if result:
                return result
            if attempt < max_retries:
                logger.warning(f"빈 응답, 재시도 {attempt + 1}/{max_retries}...")
        return ""

    async def generate_json(
        self,
        system_prompt: str,
        user_message: str,
        **kwargs,
    ) -> dict:
        """JSON 응답 생성"""
        response = await self.generate(
            system_prompt + "\n\nRespond ONLY with valid JSON.",
            user_message,
            **kwargs,
        )
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            repaired = repair_json(response)
            return json.loads(repaired)


# ------------------------------------------------------------------ #
# 싱글톤 팩토리
# ------------------------------------------------------------------ #

_default_client: Optional[LLMClient] = None


def get_llm_client(model: str = None) -> LLMClient:
    """LLM_PROVIDER 환경변수 기준으로 클라이언트 반환"""
    global _default_client
    provider = os.getenv("LLM_PROVIDER", "claude-cli")
    if _default_client is None or _default_client.provider != provider:
        _default_client = LLMClient(model=model)
    return _default_client
