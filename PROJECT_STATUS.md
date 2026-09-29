# Tracc — Project Status & Plan

**Review date:** 2026-09-29 (verified by full folder sweep + test run)
**Overall:** Working local product. Backend complete, frontend live on the backend, branding done. Remaining work is hygiene (git, keys, docs, disk) + final verification.

## Verified just now

| Check | Result |
|---|---|
| Backend pytest | **43/43 pass** (~21s) |
| Frontend `vite build` + `tsc` | Pass (last verified build; `node_modules` present, `dist/` cleaned) |
| Frontend tree | Metrix/Tracc TS app intact (~50 src files) |
| `.env` + SQLite DB | Present |
| Git repo | **None — highest risk** |

## Folder map (disk)

| Path | Size | Verdict |
|---|---|---|
| `backend/` | 621MB | App + `.venv` (excluded from Docker) |
| `frontend/` | 168MB | App + `node_modules` (excluded from Docker, delete anytime) |
| `F1/` | 172MB | Dead UI package incl. `node_modules` — **leaks into Docker builds** |
| `frontend_legacy_backup/` | 90MB | Old Logix UI incl. `node_modules` (excluded from Docker) |
| `frontend_logix_backup/` | 0.2MB | Pre-Metrix backup — **leaks into Docker builds** |
| `analytics/` | 2MB | Exporter + CSVs |
| Everything else | <50MB | Docs, workflows, tests, compose files |

## What's done

* **Backend (43 tests):** JWT auth + roles, loads/carriers/drivers, analytics KPIs, ML delay-risk + SHAP (Random Forest, dynamic version), text-to-SQL guardrails, SOP RAG + uploads, keyword agent, 3 automation runners, OpenRouter + Gemini providers, rate limits, PG-ready seed/migrations, benchmark + doc-chunks endpoints.
* **Frontend (Tracc/Metrix):** auth gate + role gates, Tracc login (pixel-canvas, role cards, guard chip), sidebar + bubble theme reveal, KPIs with real sparklines, paged load board + drawer with live SHAP, risk center with live benchmark, agent/SQL/RAG copilot with markdown + loader, SOP reader + gated upload, alerts + real triggers, lane analytics + CSV export, leaderboard paging, LIVE/DEMO badges, portfolio footer cards.
* **Infra:** 4-container compose (backend/frontend/postgres/n8n), secrets via `.env`, healthchecks, restart policies, nginx `/api` proxy + 12MB uploads.

## What's left

1. **`git init` + first commit** — no version control exists. Exclude venv/node_modules/DB, never commit `.env`.
2. **Stop the Docker bloat** — add `F1/`, `frontend_logix_backup/` to `.dockerignore`; delete `frontend/node_modules`, `frontend_legacy_backup` from disk (~260MB).
3. **Rotate both API keys** — Gemini + OpenRouter keys appeared in chat; regenerate, update `.env`.
4. **Rebuild + click-through** — `docker compose up --build -d`, then login → KPIs → drawer → risk → copilot (3 modes) → upload (manager) → trigger workflow.
5. **Fix stale docs** — `README.md`, `CONTINUATION_PLAN.md`, `FRONTEND_SPEC.md`, `BASELINE_VERIFICATION.md`, `scratchpad_dmtc6ly6.md` still describe the old Logix/XGBoost/14-test project. Rewrite or delete.
6. **Import n8n workflows** into `:5678` and watch one run fire.
7. **Delete `F1/` + both backups** once 1–6 are green.
8. **Accepted tech debt** (low urgency): naive datetimes, Float money, 24h JWT without revoke, flat carrier sparklines, transit-hour estimates, global motion-kill, demo creds in bundle, unused Task-4 business defaults (OTD formula, HIGH≥0.65/MED≥0.30, 14-day pickup window, daily-report-as-alert).

## Suggested order

`1 → 2 → 3 → 4` (highest value, ~30 min), then `5 → 6`, then `7`, item 8 on demand.
