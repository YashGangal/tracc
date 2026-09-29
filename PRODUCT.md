# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (equal weight per confirmed answer):
- Dispatcher (e.g. Alex Rivera) — live board triage during dispatch: see what needs attention, open a load, understand delay risk, get a next action.
- Ops Manager (e.g. Sarah Jenkins) — oversight + control: carrier reliability, lane analytics, SOP uploads/deletes, workflow triggers, alert resolution.

Secondary: Operations Admin (full permissions), Logistics Analyst/Viewer (read-only audit).

Situation: US freight / trucking / supply-chain operations, desktop-first ops console with mobile access. Humans keep all operational decisions.

## Product Purpose

Tracc is an AI logistics operations copilot for Autonomous Dispatch & Supply Chain Intelligence. It exists to eliminate manual document searching, fragmented spreadsheets, and reactive delay troubleshooting.

What it does: live operations dashboard, searchable load board with detail drawer, ML delay-risk with dispatcher-language explanations, 3-mode AI copilot (safe Text-to-SQL, citation-enforced SOP RAG, ReAct agent), knowledge base, incident center, n8n automation + native runner, Power BI export.

Success means: dispatcher + manager can go login → KPIs → open a load → check SHAP risk → ask copilot → resolve/trigger in minutes, with honest live vs demo state throughout.

## Positioning

Neighbor-copiable claims excluded. Tracc's edge to preserve:
- Late-delivery probability per load with SHAP attribution translated into dispatcher language (“Origin pickup delay adds +X risk”), live benchmarked (random-forest-v1.0).
- Safe read-only Text-to-SQL (AST validation + table whitelist) that renders tables inline.
- Citation-enforced SOP RAG over 5 permanent official SOPs + manager uploads.
- ReAct agent with visible Thought → Action → Observation traces and name-based entity resolution.
- Offline heuristic fallback — usable with no AI keys; LIVE/DEMO badges keep state honest.

## Operating Context

Factual workflows, environments, tools:
- Core path: login (role cards) → overview KPIs (loads, OTD %, revenue, carriers) → 14-day revenue trajectory → carrier leaderboard → lane analytics → live fleet event feed → load drawer (route, carrier/driver, delivery timeline) → Predictions (SHAP) → Copilot (SQL / RAG / agent) → Knowledge (upload/delete .md/.txt/.pdf 10MB) → Alerts (resolve + trigger workflow_a/b/c) → Analytics CSV export.
- Entrypoints: App at http://localhost:5173 (nginx proxies /api → backend), API at http://localhost:8000 (/docs), n8n at http://localhost:5678. Local dev: `uvicorn app.main:app --reload --port 8000` + `npm run dev`.
- Roles: dispatcher (read + query), manager (+ upload/delete, trigger), admin (full), viewer (read-only audit).
- Conventions: OTD = delivered / (delivered + delayed); risk HIGH ≥ 0.65, MEDIUM ≥ 0.30.
- Automation: workflows/ definitions (delayed-load, daily-ops, carrier-breach) + in-app runner; real A/B/C left inactive pending Postgres credential for A.

## Capabilities and Constraints

Confirmed:
- Dashboard: live KPIs, sparklines, paged load board (limit 200), drawer with live SHAP merge, risk center, lane trends, leaderboard paging.
- AI: OpenAI / Gemini / OpenRouter / NVIDIA NIM gateway with automatic failover + offline fallback; 3 copilot modes on `/copilot/chat` with mode badges.
- Knowledge: 5 seed SOPs permanent; manager upload/delete; chunk inspection.
- Alerts: active feed, one-click resolve (no optimistic flip on failure), manual triggers for 3 workflows.
- Platform: JWT (24h, no revoke — accepted debt), bcrypt, Pydantic v2, rate limits, audit logging, guarded SQL, dark/light themes with bubble reveal + motion kill-switch, route-split bundles, `tsc` clean.

Must never break for polish: 4-role gates, guarded SQL, audit log, dark/light + reduced-motion + keyboard paths, honest LIVE/DEMO labeling, human-decides (AI recommends only), seed SOP permanence.

Accepted debt (do not polish around as if bugs): naive datetimes, Float money, flat carrier sparklines, transit-hour estimates, global motion-kill, demo creds in bundle.

## Brand Commitments

- Name: Tracc. Tagline: Autonomous Dispatch & Supply Chain Intelligence.
- Existing footer attribution: Architected by Yash Gangal (GitHub / LinkedIn cards in global footer) — preserve, do not restyle as marketing claim.
- No binding palette/type/era pinned during init; incumbent Tracc/Metrix dark-first dashboard is the visual authority until document/new-work records otherwise.

## Evidence on Hand

- `README.md` (capabilities, stack, demo accounts, endpoints), `PROJECT_STATUS.md` (2026-09-29 verified: 43/43 pytest, vite build + tsc clean, Docker 4-container green), `docs/product-requirements.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/AI_QUALITY_EVALUATION.md`, `docs/INTEGRATION_DECISIONS.md`.
- `frontend/src/App.tsx` + `frontend/src/components/dashboard/` + `frontend/src/components/codedvisuals/` (incumbent implementation).
- `workflows/` n8n definitions, `analytics/` star-schema exporter + DAX guide, `backend/app/ml/benchmark_metrics.json` (model version/metrics source of truth).
- Demo accounts exist for dispatcher/manager/admin/viewer; no fabricated testimonials, customers, benchmarks, or pricing to use.

## Product Principles

1. Human decides, AI assists — recommend, analyze, summarize, alert; never auto-execute ops actions.
2. Safe by default — guarded reads, citations, role gates, and honest failure states over cleverness.
3. Dispatcher language over model language — every probability ships with a next action.
4. Live truth, labeled fallback — LIVE/DEMO, empty/error/loading states always explicit.
5. Role-appropriate power — same console, gated controls; read paths stay fast for all.
