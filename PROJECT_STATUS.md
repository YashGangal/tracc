# Tracc — Project Status & Plan

**Review date:** 2026-09-29 (verified by full folder sweep + test run)
**Cleanup + git:** 2026-09-29 — dead weight deleted (~350MB), docs → `docs/`, ignore files hardened, first commit `7b3aeb2` (119 files, clean tree).
**Phase 1 conversational copilot (backend):** chitchat intents + unified `POST /copilot/chat` (intent routing, session memory, persona) + name-based driver/carrier/load resolution replacing silent wrong-entity fallbacks. 58/58 pytest. Frontend chat UI (Phase 2) not started.
**Phase 2 chat UI:** unified thread on `/copilot/chat` (auto-routing + per-answer mode badges), SQL tables inline, stop/new-chat, mode override chips, auto-scroll, Tracc welcome. `tsc` + build clean.
**LLM providers:** OpenAI / Gemini / OpenRouter + NVIDIA NIM (`AI_PROVIDER=nvidia`, free trial key from build.nvidia.com), automatic failover across providers, offline heuristic fallback. 79/79 pytest.
**Overall:** Working local product, now version-controlled. Remaining work is keys, docs rewrite, Docker rebuild + verification.

## Verified just now

| Check | Result |
|---|---|
| Backend pytest | **43/43 pass** (~21s) |
| Frontend `vite build` + `tsc` | Pass (last verified build; `node_modules` present, `dist/` cleaned) |
| Frontend tree | Metrix/Tracc TS app intact (~50 src files) |
| `.env` + SQLite DBs | Present on disk, gitignored (never committed) |
| Git repo | **Initialized — first commit `7b3aeb2`, 119 files, clean tree** |

## Folder map (disk)

| Path | Size | Verdict |
|---|---|---|
| `backend/` | ~620MB (app + local-only `.venv`, gitignored) | App + `.venv` (excluded from git + Docker) |
| `frontend/` | App + `node_modules` removed from disk (`npm install` restores) | Source only — reinstallable deps excluded |
| `docs/` | Planning/spec docs moved out of root | `README.md` + `PROJECT_STATUS.md` stay at root |
| `analytics/` | 2MB | Exporter + CSVs (exports/ gitignored, regenerable) |
| ~~`F1/`~~, ~~`frontend_legacy_backup/`~~, ~~`frontend_logix_backup/`~~ | **Deleted 2026-09-29** (~260MB reclaimed) | Dead UI packages — no code referenced them |
| Everything else | <50MB | Docs, workflows, tests, compose files |

## What's done

* **Backend (43 tests):** JWT auth + roles, loads/carriers/drivers, analytics KPIs, ML delay-risk + SHAP (Random Forest, dynamic version), text-to-SQL guardrails, SOP RAG + uploads, keyword agent, 3 automation runners, OpenRouter + Gemini providers, rate limits, PG-ready seed/migrations, benchmark + doc-chunks endpoints.
* **Frontend (Tracc/Metrix):** auth gate + role gates, Tracc login (pixel-canvas, role cards, guard chip), sidebar + bubble theme reveal, KPIs with real sparklines, paged load board + drawer with live SHAP, risk center with live benchmark, agent/SQL/RAG copilot with markdown + loader, SOP reader + gated upload, alerts + real triggers, lane analytics + CSV export, leaderboard paging, LIVE/DEMO badges, portfolio footer cards.
* **Infra:** 4-container compose (backend/frontend/postgres/n8n), secrets via `.env`, healthchecks, restart policies, nginx `/api` proxy + 12MB uploads.

## What's left

1. ✅ ~~`git init` + first commit~~ — done 2026-09-29 (`7b3aeb2`, `.env`/`*.db`/venv excluded).
2. ✅ ~~Stop the Docker bloat~~ — `F1/`, both backups, `frontend/node_modules` deleted; `.dockerignore` rewritten (also covers `*.db`, `.env`, exports).
3. **Rotate both API keys** — Gemini + OpenRouter keys appeared in chat; regenerate, update `.env`.
4. ✅ ~~Rebuild + click-through~~ — verified 2026-09-29 on **local stack** (backend `43/43` pytest, full API pass, `vite build` + `tsc` clean), then **fully on Docker**: user ran `docker compose up --build -d` in WSL Ubuntu — all 4 containers Up (backend healthy, postgres healthy), container API pass green against Postgres (10k loads, 84.9% OTD, SHAP, high-risk, 5 SOP docs, alerts), WSL→Windows localhost relays fixed (backend container restarted to claim `:8000`), retired the temporary Windows uvicorn/vite servers. Live at `http://localhost:5173` (app) + `:8000` (API) + `:5678` (n8n).
5. ✅ ~~Fix stale docs~~ — done 2026-09-29: `README.md` rewritten (Random Forest metrics, 45 tests, current structure); deleted `CONTINUATION_PLAN.md`, `BASELINE_VERIFICATION.md`, `FRONTEND_SPEC.md`, `implementation_plan.md` (obsolete pre-build plans); kept PRD, integration decisions, runbook (link fixed), AI quality guide. `docs/` now holds 4 valid files.
6. ✅ ~~Import n8n workflows~~ — done 2026-09-29: all 3 workflows imported into `:5678` (added import-safe `id`/`active` fields); **live fire verified** — a temp 1-min schedule clone of Workflow C posted real `high_risk_carrier` alerts via the `X-Workflow-Token` path (47 on first fire), then test alerts resolved and temp workflows deactivated. Real fix found on the way: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` added to compose (workflows read the token via `{{ $env.WORKFLOW_API_TOKEN }}`). Temp `wf-temp-*` workflows left inactive in n8n — delete them in the UI. NOTE: real A/B/C left **inactive** — Workflow A still needs a Postgres credential in n8n before activation.
7. ✅ ~~Delete `F1/` + both backups~~ — done 2026-09-29 (nothing referenced them).
8. **Accepted tech debt** (low urgency): naive datetimes, Float money, 24h JWT without revoke, flat carrier sparklines, transit-hour estimates, global motion-kill, demo creds in bundle, unused Task-4 business defaults (OTD formula, HIGH≥0.65/MED≥0.30, 14-day pickup window, daily-report-as-alert).

## Suggested order

`1 → 2 → 3 → 4` (highest value, ~30 min), then `5 → 6`, then `7`, item 8 on demand.
