# Tracc — Project Status & Plan

**Review date:** 2026-09-29 (verified by full folder sweep + test run)
**Cleanup + git:** 2026-09-29 — dead weight deleted (~350MB), docs → `docs/`, ignore files hardened, first commit `7b3aeb2` (119 files, clean tree).
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
4. ✅ ~~Rebuild + click-through~~ — verified 2026-09-29 on **local stack** (Docker Desktop not installed on this machine): backend `43/43` pytest, uvicorn `:8000` healthy, full API pass green (login dispatcher+manager, KPIs 10k loads/84.1% OTD, load drawer, SHAP prediction, SQL/RAG/agent copilot, manager upload, workflow_a trigger → 1 alert, resolve), frontend `npm install` + `vite build` + `tsc` clean, dev server `:5173` up. Container leg (`docker compose up --build`) still pending Docker install.
5. **Fix stale docs** — `README.md`, `CONTINUATION_PLAN.md`, `FRONTEND_SPEC.md`, `BASELINE_VERIFICATION.md`, `scratchpad_dmtc6ly6.md` still describe the old Logix/XGBoost/14-test project. Rewrite or delete.
6. **Import n8n workflows** into `:5678` and watch one run fire.
7. ✅ ~~Delete `F1/` + both backups~~ — done 2026-09-29 (nothing referenced them).
8. **Accepted tech debt** (low urgency): naive datetimes, Float money, 24h JWT without revoke, flat carrier sparklines, transit-hour estimates, global motion-kill, demo creds in bundle, unused Task-4 business defaults (OTD formula, HIGH≥0.65/MED≥0.30, 14-day pickup window, daily-report-as-alert).

## Suggested order

`1 → 2 → 3 → 4` (highest value, ~30 min), then `5 → 6`, then `7`, item 8 on demand.
