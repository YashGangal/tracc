import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProvider:
    """
    Unified AI provider supporting OpenAI, Anthropic, Gemini, Ollama, 
    and offline heuristic logistics fallback.
    """

    @staticmethod
    async def generate_completion(
        prompt: str,
        system_prompt: str = "You are an expert AI Logistics Operations Copilot.",
        temperature: float = 0.2,
        max_tokens: int = 1000
    ) -> str:
        # 1. Try the configured provider. "auto" retains a provider fallback order.
        # Log non-200 responses instead of silently falling through to heuristics.
        if settings.AI_PROVIDER in {"gemini", "auto"} and settings.GEMINI_API_KEY:
            try:
                # Key travels in the x-goog-api-key header (never the URL) so
                # request logs can't leak the credential.
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
                headers = {"x-goog-api-key": settings.GEMINI_API_KEY}
                payload = {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}
                    ],
                    "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Some models (e.g. free reasoning models) reply with
                        # null/empty content — treat as a miss, not an answer.
                        content = data["candidates"][0]["content"]["parts"][0]["text"]
                        if content and content.strip():
                            return content
                        logger.warning("Gemini API returned empty content; falling back to offline heuristics.")
                    # Log Google's error body (no credentials in it — key travels by header).
                    try:
                        err_body = resp.text[:300]
                    except Exception:
                        err_body = "<unreadable>"
                    logger.warning(f"Gemini API returned {resp.status_code}: {err_body}; falling back to offline heuristics.")
            except Exception as e:
                logger.warning(f"Gemini generation error: {e}")

        # 2. Try OpenAI if selected and a key is available.
        if settings.AI_PROVIDER in {"openai", "auto"} and settings.OPENAI_API_KEY:
            try:
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                payload = {
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        if content and content.strip():
                            return content
                        logger.warning("OpenAI API returned empty content; falling back to offline heuristics.")
                    logger.warning(f"OpenAI API returned {resp.status_code}; falling back to offline heuristics.")
            except Exception as e:
                logger.warning(f"OpenAI generation error: {e}")

        # 3. Try OpenRouter if selected and a key + model are available.
        if settings.AI_PROVIDER in {"openrouter", "auto"} and settings.OPENROUTER_API_KEY and settings.OPENROUTER_MODEL:
            try:
                url = "https://openrouter.ai/api/v1/chat/completions"
                # Bearer key stays in the header so request logs can't leak it.
                headers = {
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Logistics Copilot",
                }
                payload = {
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        if content and content.strip():
                            return content
                        logger.warning("OpenRouter API returned empty content; falling back to offline heuristics.")
                    try:
                        err_body = resp.text[:300]
                    except Exception:
                        err_body = "<unreadable>"
                    logger.warning(f"OpenRouter API returned {resp.status_code}: {err_body}; falling back to offline heuristics.")
            except Exception as e:
                logger.warning(f"OpenRouter generation error: {e}")

        # 4. Fallback: heuristic domain logic for local/demo operation only.
        if settings.MOCK_AI_FALLBACK:
            if settings.AI_PROVIDER in {"anthropic", "ollama"}:
                logger.warning(
                    f"AI_PROVIDER={settings.AI_PROVIDER!r} has no live implementation; "
                    "using offline heuristic fallback."
                )
            return AIProvider._offline_logistics_response(prompt, system_prompt)
        raise RuntimeError("The configured AI provider is unavailable and offline fallback is disabled.")

    @staticmethod
    def _offline_logistics_response(prompt: str, system_prompt: str) -> str:
        """Domain-tailored smart fallback when external LLM keys are unconfigured."""
        p_lower = prompt.lower()

        # Text-to-SQL intent
        if "sql" in system_prompt.lower() or "generate a safe read-only sql query" in system_prompt.lower() or "select" in p_lower:
            if "delayed" in p_lower or "late" in p_lower:
                return "SELECT load_number, origin_city, origin_state, destination_city, destination_state, status, revenue FROM loads WHERE status IN ('delayed', 'in_transit') ORDER BY pickup_datetime DESC LIMIT 20;"
            elif "revenue" in p_lower and "carrier" in p_lower:
                return "SELECT c.name as carrier_name, COUNT(l.id) as total_loads, SUM(l.revenue) as total_revenue, ROUND(AVG(CASE WHEN l.status = 'delivered' THEN 1.0 ELSE 0.0 END) * 100, 1) as on_time_rate FROM carriers c JOIN loads l ON c.id = l.carrier_id GROUP BY c.name ORDER BY total_revenue DESC LIMIT 10;"
            elif "worst" in p_lower and ("carrier" in p_lower or "performance" in p_lower):
                return "SELECT c.name as carrier_name, COUNT(l.id) as total_loads, ROUND(AVG(CASE WHEN l.status = 'delivered' THEN 1.0 ELSE 0.0 END) * 100, 1) as on_time_rate FROM carriers c JOIN loads l ON c.id = l.carrier_id GROUP BY c.name HAVING COUNT(l.id) >= 5 ORDER BY on_time_rate ASC LIMIT 5;"
            elif "driver" in p_lower:
                return "SELECT d.name, d.safety_score, d.experience_years, d.status, c.name as carrier_name FROM drivers d JOIN carriers c ON d.carrier_id = c.id ORDER BY d.safety_score DESC LIMIT 10;"
            elif "high risk" in p_lower or "risk" in p_lower:
                return "SELECT load_number, origin_city, destination_city, distance_miles, status, revenue FROM loads WHERE status = 'in_transit' ORDER BY distance_miles DESC LIMIT 10;"
            else:
                return "SELECT load_number, origin_city, origin_state, destination_city, destination_state, status, distance_miles, revenue FROM loads ORDER BY pickup_datetime DESC LIMIT 15;"

        # Summarizing SQL query execution
        if "summarize" in system_prompt.lower() or "explain" in system_prompt.lower() or "results:" in prompt.lower():
            return "Based on the operational query results, the data highlights key logistics trends. On-time delivery performance averages 92.4% across active loads, with specific carriers experiencing transit variance on longer interstate lanes. Recommend reviewing delayed shipments and following up with dispatch."

        # RAG or general answer
        return (
            "Operational Analysis Summary: Based on standard operating procedures and live system records, "
            "all active dispatches should adhere strictly to carrier compliance criteria, check driver HOS compliance, "
            "and escalate any load exceeding 60 minutes of transit deviation to the senior operations manager."
        )

    @staticmethod
    def get_embedding(text: str) -> List[float]:
        """
        Produce a normalized 64-dimensional semantic embedding vector using deterministic character n-gram hashing,
        allowing vector similarity without downloading gigabytes of external models.
        """
        vec = [0.0] * 64
        cleaned = text.lower().strip()
        if not cleaned:
            return vec
        
        words = cleaned.split()
        for i, word in enumerate(words):
            for j, ch in enumerate(word):
                idx = (ord(ch) * 13 + i * 7 + j * 3) % 64
                vec[idx] += 1.0
        
        # L2 normalize
        magnitude = sum(x * x for x in vec) ** 0.5
        if magnitude > 0:
            vec = [x / magnitude for x in vec]
        return vec
