"""Lightweight in-memory rate limiter for LLM-backed endpoints.

No external dependencies: sliding window per client IP. Returns 429 when
the window budget is exhausted. Counters reset on restart by design.
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

# path prefix -> (max requests, window seconds)
LIMITED_PREFIXES: Dict[str, Tuple[int, int]] = {
    "/api/v1/copilot": (30, 60),
    "/api/v1/agent": (30, 60),
    "/api/v1/rag/query": (60, 60),
}

_hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        path = request.url.path
        rule = next((v for prefix, v in LIMITED_PREFIXES.items() if path.startswith(prefix)), None)
        if rule is None:
            return await call_next(request)
        max_req, window = rule
        now = time.monotonic()
        key = (_client_ip(request), next(p for p in LIMITED_PREFIXES if path.startswith(p)))
        bucket = _hits[key]
        while bucket and bucket[0] <= now - window:
            bucket.popleft()
        if len(bucket) >= max_req:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests — wait a moment and retry."},
            )
        bucket.append(now)
        return await call_next(request)
