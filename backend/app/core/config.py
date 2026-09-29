import logging
import os
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger(__name__)

_DEV_SECRET_FALLBACK = "dev-only-insecure-secret-change-me-set-SECRET_KEY-env"


def _default_sqlite_url() -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    path = os.path.join(base_dir, "logistics_copilot.db").replace(os.sep, "/")
    return f"sqlite:///{path}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Logistics Operations Copilot"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Secret key for JWT. Stable dev fallback so restarts don't invalidate tokens.
    # Docker Compose requires a real SECRET_KEY via environment; Postgres-backed
    # deployments refuse to start with the fallback (see bottom of file).
    SECRET_KEY: str = _DEV_SECRET_FALLBACK
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    SQL_QUERY_MAX_LENGTH: int = 5_000
    SQL_QUERY_MAX_ROWS: int = 50
    SQL_QUERY_TIMEOUT_MS: int = 5_000

    # Database
    # Local development defaults to SQLite. Staging/production must provide DATABASE_URL for PostgreSQL.
    DATABASE_URL: str = ""
    SQLITE_FALLBACK_URL: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ]

    # AI Providers & Keys
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: Optional[str] = None
    AI_PROVIDER: str = "openai"
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    @field_validator("AI_PROVIDER", mode="before")
    @classmethod
    def _normalize_ai_provider(cls, v):
        return str(v or "openai").lower()
    
    # When no API key is provided, system uses sophisticated domain-specific deterministic heuristics for RAG & SQL
    MOCK_AI_FALLBACK: bool = True

    # Document scanning is fail-closed when enabled. Keep it off only for local development.
    DOCUMENT_SCAN_REQUIRED: bool = False
    CLAMAV_HOST: str = "localhost"
    CLAMAV_PORT: int = 3310

    # Service credential used only by the n8n workflow runner.
    WORKFLOW_API_TOKEN: Optional[str] = None

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()

# Resolve filesystem-dependent SQLite defaults after env loading so an explicit
# DATABASE_URL (env or .env) always wins; empty means "use local SQLite file".
if not settings.DATABASE_URL:
    settings.DATABASE_URL = _default_sqlite_url()
if not settings.SQLITE_FALLBACK_URL:
    settings.SQLITE_FALLBACK_URL = settings.DATABASE_URL if settings.DATABASE_URL.startswith("sqlite") else _default_sqlite_url()

if settings.SECRET_KEY == _DEV_SECRET_FALLBACK:
    if settings.DATABASE_URL.startswith("postgresql"):
        raise RuntimeError(
            "SECRET_KEY is not set and DATABASE_URL points at PostgreSQL. "
            "Set a strong SECRET_KEY env var before starting a shared deployment."
        )
    logger.warning(
        "SECRET_KEY is not set — using stable dev-only fallback. "
        "Set a strong SECRET_KEY env var for any shared/staging/prod deployment."
    )
