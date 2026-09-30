# Tracc — AI Logistics Operations Copilot

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](backend/requirements.txt)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](backend/app/main.py)
[![React 19](https://img.shields.io/badge/react-19-61DAFB.svg)](frontend/package.json)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED.svg)](docker-compose.yml)
[![Tests](https://img.shields.io/badge/pytest-88_passed-brightgreen.svg)](tests/test_api.py)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Autonomous Dispatch & Supply Chain Intelligence.** An AI-powered operations copilot for US freight, trucking, and supply-chain logistics — built to eliminate manual document searching, fragmented spreadsheets, and reactive delay troubleshooting.

The AI assists operations staff (recommend, analyze, summarize, alert). **Humans keep all operational decisions.**

---

## Demo (60 seconds)

1. Log in as dispatcher → live KPIs, revenue trajectory, carrier leaderboard
2. Open a load → route, carrier/driver, delivery timeline, live SHAP delay risk
3. Ask the copilot: `hi` → `How is driver Garcia doing?` → `What is his safety score?` (one thread, routed automatically)
4. Upload an SOP as manager, then delete it again from the Knowledge Base
5. Trigger `workflow_a` from Alerts Center → watch the incident appear → resolve it

---

## 1. What it does

| Area | Capability |
|---|---|
| **Operations dashboard** | Live KPIs (loads, OTD %, revenue, carriers), 14-day revenue trajectory, carrier leaderboard with real 7-week OTD sparklines, lane analytics, live fleet event feed |
| **Load board** | Searchable/filterable dispatches with a slide-over detail drawer (route, carrier/driver, delivery-event timeline) |
| **ML delay-risk center** | Late-delivery probability per load with SHAP factor attribution translated into dispatcher language ("Origin pickup delay adds +X risk") |
| **AI Copilot (unified chat)** | One ChatGPT-style thread on `POST /copilot/chat` (+ SSE streaming at `/copilot/chat/stream`): chit-chat intents, session memory, name-based driver/carrier/load resolution, safe read-only **Text-to-SQL** (with self-repair), citation-enforced **SOP RAG**, and a **ReAct agent** with visible Thought → Action → Observation traces |
| **Knowledge base** | 5 official SOPs indexed (permanent); managers can upload (`.md/.txt/.pdf`, 10 MB) and **delete** wrongly-uploaded documents |
| **Incident center** | Active alert feed with one-click resolve + manual triggers for delayed-load, daily-ops-briefing, and high-risk-carrier workflows |
| **Automation** | n8n workflow definitions plus a native in-app runner for instant testing |
| **Analytics export** | Power BI star-schema CSV exporter (`Fact_Loads`, `Dim_Carrier/Driver/Customer/Route`) with DAX guide |
| **Platform** | JWT auth with 4 roles, audit logging, rate limits, guarded SQL (AST validation + table whitelist), dark/light themes, keyboard-accessible UI with reduced-motion support |

---

## 2. Tech stack

- **Backend:** FastAPI · SQLAlchemy · PostgreSQL + pgvector (Docker) with automatic SQLite fallback (local) · JWT + bcrypt · Pydantic v2
- **ML:** scikit-learn Random Forest + SHAP TreeExplainer, serialized artifacts for sub-ms inference; model version reported dynamically from `benchmark_metrics.json` (currently `random-forest-v1.0`: accuracy **0.977**, precision **1.000**, recall **0.856**, F1 **0.923**)
- **AI providers:** OpenAI / Gemini / OpenRouter / NVIDIA NIM gateway with automatic failover (including retry on transient 429/503) and offline heuristic fallback (works with no keys)
- **Frontend:** React 19 + Vite + Tailwind 4 + Recharts + Lucide (`frontend/`, route-split, `tsc` clean)
- **Infra:** Docker Compose (postgres, backend, frontend/nginx, n8n) · GitHub Actions CI (pytest + frontend build)

---

## 3. Quickstart

### Option A — Docker (recommended)

```bash
cp .env.example .env   # then fill in every secret
docker compose up --build -d
```

- App: `http://localhost:5173` (nginx proxies `/api` → backend)
- API: `http://localhost:8000` (Swagger at `/docs`)
- n8n: `http://localhost:5678` (import `workflows/*.json`, add a Postgres credential to Workflow A, then Publish)

**Free cloud hosting:** [`DEPLOY.md`](DEPLOY.md) — backend on Render + frontend on Cloudflare Pages, $0/month.

### Option B — Local development

```bash
# Backend
cd backend
python -m venv .venv && .\.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app/db/seed_data.py 10000   # synthetic dataset
python app/ml/train.py             # (optional) retrain + refresh artifacts
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

### Demo accounts (seeded fakes for local evaluation)

| Persona | Email | Password | Can |
|---|---|---|---|
| Alex Rivera (Dispatcher) | `alex.dispatcher@logistics.copilot` | `dispatcher123` | Read + query |
| Sarah Jenkins (Ops Manager) | `sarah.manager@logistics.copilot` | `manager123` | + upload / delete docs, trigger workflows |
| Operations Admin | `admin@logistics.copilot` | `admin123` | Full permissions |
| Logistics Analyst (Viewer) | `viewer@logistics.copilot` | `viewer123` | Read-only audit |

---

## 4. Key API endpoints (`/api/v1`)

- Auth: `POST /auth/login`, `GET /auth/me`
- Chat: `POST /copilot/chat`, `POST /copilot/chat/stream` (SSE)
- Loads: `GET /loads`, `GET /loads/{id}` · Carriers/drivers: `GET /carriers…`, `GET /drivers…`
- Analytics: `GET /analytics/kpis`, `/revenue-trends`, `/carrier-performance` (with `weekly_on_time`), `/lane-trends`
- Predictions: `GET /predictions/load/{id}`, `GET /predictions/batch/high-risk`
- AI: `POST /copilot/query`, `POST /rag/query`, `POST /agent/chat`
- Knowledge: `GET /rag/documents`, `POST /rag/upload`, `DELETE /rag/documents/{id}`, `GET /rag/documents/{id}/chunks`
- Alerts: `GET /alerts`, `POST /alerts/{id}/resolve`, `POST /alerts/trigger/{workflow_a|workflow_b|workflow_c}`

Conventions: on-time delivery = `delivered / (delivered + delayed)`; risk `HIGH ≥ 0.65`, `MEDIUM ≥ 0.30` (tunable in `backend/app/core/business_rules.py`).

---

## 5. Verify it works

```bash
python -m pytest tests/ -v        # 88 backend tests (auth, data, SQL guardrails + self-repair, RAG, agent, chat intents, entity resolution, uploads, deletes, streaming, rate limits)
cd frontend && npm run lint       # tsc --noEmit
npm run build                     # production build
```

End-to-end click-through: login → KPIs → open a load → Predictions (SHAP) → Copilot in one thread (`hi` → driver question → follow-up) → (manager) upload + delete a doc → trigger + resolve a workflow.

---

## 6. Repo layout

```
backend/          FastAPI app (api, core, db, ml, schemas, services) + requirements.txt
frontend/         React + Vite + Tailwind app (dashboard, copilot, load board, risk, knowledge, alerts)
tests/            pytest suite (tests/test_api.py)
workflows/        n8n workflow definitions (delayed-load, daily-ops, carrier-breach)
analytics/        Power BI star-schema exporter + DAX/README guide
docs/             Product requirements, decisions, runbook, AI quality guide
.github/          CI workflow (backend tests + frontend build)
docker-compose.yml · Dockerfile.backend · Dockerfile.frontend · nginx.conf
PROJECT_STATUS.md Live project status & remaining work tracker
```

Further reading: [`docs/product-requirements.md`](docs/product-requirements.md) (PRD) · [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) (backups, scanning, audit review) · [`docs/AI_QUALITY_EVALUATION.md`](docs/AI_QUALITY_EVALUATION.md) (pilot acceptance criteria) · [`docs/INTEGRATION_DECISIONS.md`](docs/INTEGRATION_DECISIONS.md) · [`PROJECT_STATUS.md`](PROJECT_STATUS.md)

---

## 7. Known limitations (accepted trade-offs)

- **Money is `Float`, not `Numeric`.** Fine for synthetic demo data; a production ledger would migrate to `Numeric(12, 2)`.
- **Naive datetimes.** All timestamps are UTC-naive — correct for single-timezone ops, insufficient for multi-TZ production.
- **Free-tier LLM quotas.** OpenRouter (~50 req/day) and NVIDIA NIM (RPM-capped) fall back to offline heuristics when exhausted; the app stays fully usable, prose just gets templated.
- **Demo credentials** are one-click logins for the seeded demo dataset (documented above); they unlock nothing real.
- **Business thresholds** (risk bands, 14-day window, breach rate, 48 mph) live in `backend/app/core/business_rules.py` — one place, human-tuned, not learned.

---

## License

MIT — see [LICENSE](LICENSE). Built by [Yash Gangal](https://github.com/YashGangal).
