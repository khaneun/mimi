#!/usr/bin/env python3
"""
AWS Secrets Manager → os.environ 로더

사용법:
  # 앱 진입점 최상단에서 호출 (dotenv보다 먼저)
  from utils.load_secrets import load_secrets
  load_secrets()

동작 방식:
  1. AWS Secrets Manager에서 'mimi/production' 시크릿을 읽어 os.environ에 설정
  2. 이미 설정된 환경변수는 덮어쓰지 않음 (명시적 env var가 Secrets Manager보다 우선)
  3. boto3 / IAM 권한 없으면 조용히 skip (로컬 개발 시 .env 사용)

EC2 운용 시:
  - EC2 인스턴스에 mimi-trader-role (SecretsManagerReadPolicy) 부착 필수
  - .env 파일은 EC2에 배포하지 않음
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

SECRET_NAME = os.getenv("MIMI_SECRET_NAME", "mimi/production")
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-northeast-2")


def load_secrets(
    secret_name: str = SECRET_NAME,
    region: str = AWS_REGION,
    override: bool = False,
) -> bool:
    """
    Secrets Manager 시크릿을 os.environ에 로드한다.

    Args:
        secret_name: Secrets Manager 시크릿 이름 (기본: mimi/production)
        region: AWS 리전
        override: True면 이미 설정된 환경변수도 덮어씀 (기본: False)

    Returns:
        True — 로드 성공 / False — 스킵 (boto3 없음 또는 권한 없음)
    """
    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError
    except ImportError:
        logger.debug("boto3 없음 — Secrets Manager 스킵, .env 파일 사용")
        return False

    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        secrets: dict = json.loads(response["SecretString"])

        loaded = 0
        skipped = 0
        for key, value in secrets.items():
            if override or key not in os.environ:
                os.environ[key] = str(value)
                loaded += 1
            else:
                skipped += 1

        logger.info(
            f"Secrets Manager '{secret_name}' 로드 완료: "
            f"{loaded}개 설정, {skipped}개 기존값 유지"
        )
        return True

    except (ClientError, NoCredentialsError) as e:
        code = getattr(e, "response", {}).get("Error", {}).get("Code", str(e))
        logger.debug(f"Secrets Manager 스킵 ({code}) — 로컬 .env 사용")
        return False
    except Exception as e:
        logger.warning(f"Secrets Manager 로드 실패: {e}")
        return False


def load_env(secret_name: str = SECRET_NAME, region: str = AWS_REGION) -> None:
    """
    환경 변수 통합 로더 (앱 진입점에서 호출)

    우선순위:
      1. 이미 설정된 os.environ (명시적 설정 최우선)
      2. AWS Secrets Manager (EC2 배포 환경)
      3. .env 파일 (로컬 개발 환경)
    """
    # Secrets Manager 먼저 시도
    sm_ok = load_secrets(secret_name=secret_name, region=region)

    # .env fallback (Secrets Manager 실패 또는 로컬 개발)
    try:
        from dotenv import load_dotenv
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)  # 기존 env var 덮어쓰지 않음
            if not sm_ok:
                logger.debug(f".env 파일 로드: {env_path}")
    except ImportError:
        pass


if __name__ == "__main__":
    # 직접 실행 시 로드된 시크릿 키 목록 출력 (값은 마스킹)
    logging.basicConfig(level=logging.INFO)
    load_env()
    secret_keys = [
        "KRX_ID", "KIS_PAPER_APP_KEY", "KIS_REAL_APP_KEY",
        "TELEGRAM_BOT_TOKEN", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY",
    ]
    print("\n=== 환경변수 로드 결과 ===")
    for key in secret_keys:
        val = os.getenv(key, "")
        masked = val[:4] + "****" + val[-4:] if len(val) > 8 else ("설정됨" if val else "미설정")
        print(f"  {key}: {masked}")
