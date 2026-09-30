# Tracc — AI Logistics Operations Copilot

> **Autonomous Dispatch & Supply Chain Intelligence.** An enterprise-grade, AI-powered operations copilot for US freight, trucking, and supply-chain logistics — built to eliminate manual document searching, fragmented spreadsheets, and reactive delay troubleshooting.

The AI assists operations staff (recommend, analyze, summarize, alert). Humans keep all operational decisions.

---

## 1. What it does

| Area | Capability |
|---|---|
| **Operations dashboard** | Live KPIs (loads, OTD %, revenue, carriers), 14-day revenue trajectory, carrier leaderboard, lane analytics, live fleet event feed |
| **Load board** | Searchable/filterable dispatches with a slide-over detail drawer (route, carrier/driver, delivery-event timeline) |
| **ML delay-risk center** | Late-delivery probability per load with SHAP factor attribution translated into dispatcher language ("Origin pickup delay adds +X risk") |
| **AI Copilot (unified chat)** | One ChatGPT-style thread on `POST /copilot/chat` (+ SSE streaming at `/copilot/chat/stream`): chit-chat intents, session memory, name-based driver/carrier/load resolution, safe read-only **Text-to-SQL**, citation-enforced **SOP RAG**, and a **ReAct agent** with visible Thought → Action → Observation traces |
| **Knowledge base** | 5 official SOPs indexed; managers can upload (`.md/.txt/.pdf`, 10 MB) and **delete** wrongly-uploaded documents. Seed SOPs are permanent |
| **Incident center** | Active alert feed with one-click resolve + manual triggers for delayed-load, daily-ops-briefing, and high-risk-carrier workflows |
| **Automation** | n8n workflow definitions plus a native in-app runner for instant testing |
| **Analytics export** | Power BI star-schema CSV exporter (`Fact_Loads`, `Dim_Carrier/Driver/Customer/Route`) with DAX guide |
| **Platform** | JWT auth with 4 roles, audit logging, rate limits, guarded SQL (AST validation + table whitelist), dark/light themes |

---

## 2. Tech stack

- **Backend:** FastAPI · SQLAlchemy · PostgreSQL + pgvector (Docker) with automatic SQLite fallback (local) · JWT + bcrypt · Pydantic v2
- **ML:** scikit-learn Random Forest + SHAP TreeExplainer, serialized artifacts for sub-ms inference; model version reported dynamically from `benchmark_metrics.json` (currently `random-forest-v1.0`: accuracy **0.977**, precision **1.000**, recall **0.856**, F1 **0.923**)
- **AI providers:** OpenAI / Gemini / OpenRouter / NVIDIA NIM gateway with automatic failover and offline heuristic fallback (works with no keys)
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
- n8n: `http://localhost:5678`

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

### Demo accounts

| Persona | Email | Password | Can |
|---|---|---|---|
| Alex Rivera (Dispatcher) | `alex.dispatcher@logistics.copilot` | `dispatcher123` | Read + query |
| Sarah Jenkins (Ops Manager) | `sarah.manager@logistics.copilot` | `manager123` | + upload / delete docs, trigger workflows |
| Operations Admin | `admin@logistics.copilot` | `admin123` | Full permissions |
| Logistics Analyst (Viewer) | `viewer@logistics.copilot` | `viewer123` | Read-only audit |

---

## 4. Key API endpoints (`/api/v1`)

- Auth: `POST /auth/login`, `GET /auth/me`
- Loads: `GET /loads`, `GET /loads/{id}` · Carriers/drivers: `GET /carriers…`, `GET /drivers…`
- Analytics: `GET /analytics/kpis`, `/revenue-trends`, `/carrier-performance`, `/lane-trends`
- Predictions: `GET /predictions/load/{id}`, `GET /predictions/batch/high-risk`
- AI: `POST /copilot/query`, `POST /rag/query`, `POST /agent/chat`
- Knowledge: `GET /rag/documents`, `POST /rag/upload`, `DELETE /rag/documents/{id}`, `GET /rag/documents/{id}/chunks`
- Alerts: `GET /alerts`, `POST /alerts/{id}/resolve`, `POST /alerts/trigger/{workflow_a|workflow_b|workflow_c}`

Conventions: on-time delivery = `delivered / (delivered + delayed)`; risk `HIGH ≥ 0.65`, `MEDIUM ≥ 0.30`.

---

## 5. Verify it works

```bash
python -m pytest tests/ -v        # 45 backend tests (auth, data, SQL guardrails, RAG, agent, ML, uploads, deletes)
cd frontend && npm run lint       # tsc --noEmit
npm run build                     # production build
```

End-to-end click-through: login → KPIs → open a load → Predictions (SHAP) → Copilot in all 3 modes → (manager) upload + delete a doc → trigger + resolve a workflow.

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
