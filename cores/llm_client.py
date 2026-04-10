"""
LLM Client — Claude Code CLI 전용

Claude Code CLI (`claude -p`)를 사용하여 LLM 호출.
현재 로그인된 계정의 토큰을 자동 사용하므로 API 키 불필요.
"""

import asyncio
import json
import logging
import os
import subprocess
from typing import Optional

from json_repair import repair_json

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-20250514"
FAST_MODEL = "claude-haiku-4-20250414"


class LLMClient:
    """Claude Code CLI 기반 LLM 클라이언트

    현재 로그인된 Claude 계정 토큰을 자동 사용합니다.
    API 키가 필요하지 않습니다.
    """

    def __init__(self, model: str = None, max_tokens: int = 8192):
        self.model = model or DEFAULT_MODEL
        self.max_tokens = max_tokens

        # Claude CLI 경로 탐색
        local_path = os.path.expanduser("~/.local/bin/claude")
        self.claude_path = local_path if os.path.exists(local_path) else "claude"
        logger.info(f"[LLM] Claude Code CLI (경로: {self.claude_path})")

    def generate_sync(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """동기 호출 — claude -p subprocess"""
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

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """비동기 호출 — executor에서 동기 호출 실행"""
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


# 싱글톤
_default_client: Optional[LLMClient] = None


def get_llm_client(model: str = None) -> LLMClient:
    """LLMClient 싱글톤 반환"""
    global _default_client
    if _default_client is None:
        _default_client = LLMClient(model=model)
    return _default_client
