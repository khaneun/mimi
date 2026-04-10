"""
LLM Client — Claude Code CLI (`claude -p`) 래퍼
Anthropic SDK 직접 호출 대신 subprocess로 claude CLI를 실행
"""

import asyncio
import os
import logging
import json
import subprocess
from typing import Optional

from json_repair import repair_json

logger = logging.getLogger(__name__)

# 기본 모델 설정 (claude CLI의 --model 옵션용)
DEFAULT_MODEL = "claude-sonnet-4-20250514"
FAST_MODEL = "claude-haiku-4-20250414"


class LLMClient:
    """Claude Code CLI를 통한 LLM 호출 클라이언트"""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        max_tokens: int = 8192,
        api_key: Optional[str] = None,
    ):
        self.model = model
        self.max_tokens = max_tokens
        # claude CLI 경로 결정
        local_path = os.path.expanduser("~/.local/bin/claude")
        self.claude_path = local_path if os.path.exists(local_path) else "claude"

    def _run_claude(self, prompt: str) -> str:
        """subprocess로 claude -p 실행 (동기)"""
        try:
            result = subprocess.run(
                [self.claude_path, "-p", prompt, "--output-format", "text"],
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode != 0:
                logger.error(f"claude CLI 실행 실패 (rc={result.returncode}): {result.stderr}")
                return ""
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            logger.error("claude CLI 타임아웃 (600초)")
            return ""
        except FileNotFoundError:
            logger.error(f"claude CLI를 찾을 수 없습니다: {self.claude_path}")
            return ""
        except Exception as e:
            logger.error(f"claude CLI 호출 중 에러: {e}")
            return ""

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """비동기 Claude CLI 호출"""
        prompt = f"{system_prompt}\n\n{user_message}"
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_claude, prompt)

    async def generate_with_retry(
        self,
        system_prompt: str,
        user_message: str,
        max_retries: int = 2,
        **kwargs,
    ) -> str:
        """Claude Code가 내부적으로 재시도를 처리하므로 단순 호출"""
        return await self.generate(system_prompt, user_message, **kwargs)

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

    def generate_sync(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
    ) -> str:
        """동기 호출"""
        prompt = f"{system_prompt}\n\n{user_message}"
        return self._run_claude(prompt)


# 싱글톤 인스턴스
_default_client: Optional[LLMClient] = None


def get_llm_client(model: str = DEFAULT_MODEL) -> LLMClient:
    """기본 LLM 클라이언트 반환"""
    global _default_client
    if _default_client is None or _default_client.model != model:
        _default_client = LLMClient(model=model)
    return _default_client
