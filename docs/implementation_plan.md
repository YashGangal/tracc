# AI Logistics Operations Copilot - Implementation Plan

> **Product:** AI-Powered Logistics Operations Platform  
> **MVP Scope:** Working end-to-end product integrating Operational Data Platform + XGBoost Late Delivery Prediction + SHAP Explanations + Text-to-SQL AI Assistant + Vector RAG Knowledge Assistant + ReAct AI Agent + n8n Workflow Automations + Modern React Dashboard.

---

## User Review Required

> [!IMPORTANT]
> **Database & Model Execution Strategy:**
> - **Database:** The primary configuration will support PostgreSQL with `pgvector` (via Docker Compose or local PostgreSQL on port 5432). To guarantee 100% zero-friction out-of-the-box local testing without requiring external service configuration, the backend will feature an automatic fallback to SQLite + vector search fallback.
> - **LLM & Embeddings:** An extensible multi-provider AI gateway will be implemented (`backend/app/core/ai_provider.py`) supporting OpenAI, Anthropic, Gemini, local Ollama, and a built-in deterministic heuristic fallback generator so all agent and RAG features function out-of-the-box even without paid API keys.
> - **Machine Learning:** XGBoost and Scikit-Learn will be trained on the synthetic logistics dataset during setup, serializing the trained model and SHAP explainer to disk (`backend/app/ml/artifacts/`) for sub-millisecond inference.

---

## Architecture Overview

```
                               ┌────────────────────────────────────────────────┐
                               │           React + Vite Frontend (UI)          │
                               │  - Operations Dashboard & Recharts KPIs       │
                               │  - AI Copilot (Text-to-SQL + RAG + Agent)     │
                               │  - Live Load Board & Tracking                 │
                               │  - ML Delay Risk & SHAP Factor Modal          │
                               │  - SOP Knowledge Base & Document Manager      │
                               │  - Alerts & Incident Management Center        │
                               └───────────────────────┬────────────────────────┘
                                                       │ REST API / JWT
                                                       ▼
                               ┌────────────────────────────────────────────────┐
                               │               FastAPI Backend Core             │
                               │  - Auth (JWT, Passlib, Roles)                  │
                               │  - Loads / Carriers / Drivers / Analytics APIs │
                               │  - Audit Logging & Rate Limiting               │
                               └───────┬──────────────┬───────────────┬─────────┘
                                       │              │               │
            ┌──────────────────────────┼──────────────┼───────────────┴───────────────┐
            │                          │              │                               │
            ▼                          ▼              ▼                               ▼
  ┌───────────────────┐      ┌──────────────────┐   ┌───────────────────┐   ┌───────────────────┐
  │   AI Assistant    │      │    RAG Engine    │   │     AI Agent      │   │    ML Service     │
  │ (Text-to-SQL)     │      │ (SOPs & Vectors) │   │ (Tool-Calling)    │   │ (XGBoost + SHAP)  │
  │ - AST Validator   │      │ - Chunking       │   │ - ReAct Loop      │   │ - Risk Classifier │
  │ - Safe Read-Only  │      │ - Cosine Sim     │   │ - 7 Domain Tools  │   │ - Factor Ranker   │
  │ - Table Whitelist │      │ - Citations Only │   │ - Safe Policy     │   │ - Feature Pipeline│
  └─────────┬─────────┘      └────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
            │                         │                       │                       │
            └─────────────────────────┼───────────────────────┴───────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │   PostgreSQL / SQLite     │
                        │ 12 Operational Entities   │
                        │ Synthetic Data (10k loads)│
                        └─────────────┬─────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
            ┌──────────────────────────┐ ┌──────────────────────────┐
            │   n8n Automation Engine  │ │  Power BI Data Exporter  │
            │ - Delayed Load Alert     │ │ - Star Schema Tables     │
            │ - Daily Ops Briefing     │ │ - KPI Summary Views      │
            │ - High-Risk Carrier Alert│ │ - PBIX Template Guide   │
            └──────────────────────────┘ └──────────────────────────┘
```

---

## Proposed Changes

### Component 1: Core Backend & Data Platform (`/backend`)

The backend will be built with **FastAPI**, **SQLAlchemy 2.0**, and **Pydantic v2**.

#### [NEW] [backend/requirements.txt](file:///d:/Codes/anticode/project1/backend/requirements.txt)
- Dependencies: `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `asyncpg`, `psycopg2-binary`, `python-jose`, `passlib`, `bcrypt`, `scikit-learn`, `xgboost`, `shap`, `joblib`, `numpy`, `pandas`, `pypdf`, `python-multipart`, `pytest`, `httpx`.

#### [NEW] [backend/app/core/config.py](file:///d:/Codes/anticode/project1/backend/app/core/config.py)
- Pydantic Settings: Database URL, Secret Key, LLM API keys (Gemini, OpenAI, Anthropic), CORS origins, mock AI mode toggles.

#### [NEW] [backend/app/db/session.py](file:///d:/Codes/anticode/project1/backend/app/db/session.py)
- Database engine initialization with graceful connection detection (PostgreSQL if available, SQLite file fallback). Read-only session factory for AI text-to-SQL.

#### [NEW] [backend/app/db/models.py](file:///d:/Codes/anticode/project1/backend/app/db/models.py)
- Complete SQLAlchemy declarative models for all 12 entities:
  - `User` (id, email, password_hash, full_name, role: `admin`, `dispatcher`, `operations_manager`, `viewer`)
  - `Customer` (id, name, code, contact_email, payment_terms)
  - `Carrier` (id, name, mc_number, dot_number, location, rating, status, fleet_size)
  - `Driver` (id, carrier_id, name, license_number, experience_years, safety_score, status)
  - `Truck` (id, carrier_id, truck_number, truck_type, model_year, status)
  - `Load` (id, load_number, customer_id, carrier_id, driver_id, truck_id, origin_city, origin_state, destination_city, destination_state, pickup_datetime, delivery_datetime, actual_delivery_datetime, distance_miles, load_type, revenue, rate_per_mile, status: `pending`, `assigned`, `in_transit`, `delivered`, `delayed`, `cancelled`)
  - `Shipment` (id, load_id, weight_lbs, commodity, pieces, special_instructions)
  - `DeliveryEvent` (id, load_id, event_type, event_timestamp, location, description, delay_minutes)
  - `Invoice` (id, load_id, invoice_number, amount, status, invoice_date, paid_date)
  - `ComplianceRecord` (id, carrier_id, driver_id, record_type, status, expiry_date, notes)
  - `Document` (id, name, file_type, storage_path, file_size, uploaded_by, created_at)
  - `KnowledgeChunk` (id, document_id, chunk_index, chunk_text, embedding_json, metadata_json)
  - `Prediction` (id, load_id, model_version, late_probability, risk_level, factor_json, created_at)
  - `Alert` (id, alert_type, severity, load_id, carrier_id, title, message, status, created_at, resolved_at)

#### [NEW] [backend/app/db/seed_data.py](file:///d:/Codes/anticode/project1/backend/app/db/seed_data.py)
- High-fidelity synthetic logistics generator creating:
  - 10,000 loads spanning the last 90 days
  - 500 carriers with realistic performance profiles (top performers, average, and chronic delayers)
  - 2,000 drivers with varying experience and safety scores
  - 1,000 trucks (Dry Van, Reefer, Flatbed)
  - 20,000+ delivery events (departures, GPS pings, traffic jams, weather hold-ups)
  - 10,000 invoices with varying payment statuses
  - 1,000 compliance safety and physical inspection records
  - Realistic statistical correlations: weather disruptions in Midwest/Northeast, carrier-specific late probability, pickup delays directly cascading into late delivery risks.

#### [NEW] [backend/app/schemas/](file:///d:/Codes/anticode/project1/backend/app/schemas/)
- Clean Pydantic schemas for auth, loads, carriers, drivers, analytics, predictions, RAG, alerts, and agent queries.

#### [NEW] [backend/app/api/v1/](file:///d:/Codes/anticode/project1/backend/app/api/v1/)
- REST Endpoints:
  - `/auth/login`, `/auth/me`
  - `/loads`, `/loads/{id}`, `/loads/stats/summary`
  - `/carriers`, `/carriers/{id}`, `/carriers/{id}/performance`
  - `/drivers`, `/drivers/{id}`
  - `/analytics/kpis`, `/analytics/carrier-performance`, `/analytics/trends`
  - `/predictions/load/{id}`, `/predictions/batch-risk`
  - `/alerts`, `/alerts/{id}/resolve`
  - `/copilot/query` (Text-to-SQL)
  - `/rag/upload`, `/rag/query`, `/rag/documents`
  - `/agent/chat` (Multi-step tool agent)

---

### Component 2: Machine Learning & SHAP Pipeline (`/backend/app/ml`)

#### [NEW] [backend/app/ml/dataset.py](file:///d:/Codes/anticode/project1/backend/app/ml/dataset.py)
- Feature extraction pipeline extracting training matrices:
  - Route distance (miles)
  - Carrier historical late rate (%)
  - Driver experience years & safety score
  - Pickup delay in minutes (departure vs scheduled)
  - Load type (Dry Van, Reefer, Flatbed)
  - Day of week & scheduled duration
  - High-traffic / severe weather route risk flag
- Target variable: `is_late` (binary: 0 = On Time, 1 = Late).

#### [NEW] [backend/app/ml/train.py](file:///d:/Codes/anticode/project1/backend/app/ml/train.py)
- Model training & benchmark suite comparing:
  - Logistic Regression (baseline)
  - Random Forest Classifier
  - XGBoost Classifier
- Evaluates metrics: Precision, Recall (late deliveries), F1-score, ROC-AUC, PR-AUC, Confusion Matrix.
- Saves the optimal model and preprocessor to disk (`model.joblib`).
- Pre-computes SHAP TreeExplainer for real-time attribution.

#### [NEW] [backend/app/ml/predictor.py](file:///d:/Codes/anticode/project1/backend/app/ml/predictor.py)
- Real-time inference service:
  - Takes any load ID or custom load payload.
  - Computes features, runs XGBoost model, outputs `late_probability` (0-100%) and `risk_level` (`LOW`, `MEDIUM`, `HIGH`).
  - Computes exact SHAP values and translates the top 3 contributing factors into dispatcher-friendly explanations (e.g., *"Pickup was delayed by 115 minutes (+42% late risk)"*, *"Carrier historical late delivery rate is 28.5% (+22% late risk)"*).

---

### Component 3: AI Data Assistant (Text-to-SQL) (`/backend/app/services/text_to_sql.py`)

#### [NEW] [backend/app/services/text_to_sql.py](file:///d:/Codes/anticode/project1/backend/app/services/text_to_sql.py)
- Safe Text-to-SQL engine:
  - Table and Column schema context generator.
  - LLM prompt engineering with zero-shot / few-shot logistics domain queries.
  - **Security & Safety Guardrails**:
    - Query parser enforcing strict `SELECT` only queries.
    - Blacklist regex blocking `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `UNION`, `EXEC`.
    - Allowed table whitelist check (can only query operational tables, never `users` table password hashes).
    - Database execution with read-only connection, query timeout (5s), and row limit (max 100 rows).
  - LLM synthesis step: Converts tabular SQL output into clear, executive operational natural language summary.

---

### Component 4: RAG Knowledge Assistant (`/backend/app/services/rag.py`)

#### [NEW] [backend/app/services/rag.py](file:///d:/Codes/anticode/project1/backend/app/services/rag.py)
- Document processor for PDF, TXT, and Markdown files.
- Text chunking (500 tokens with 50-token overlap).
- Vector embedding generation and cosine similarity retrieval.
- Grounded generation with strict prompt instructions:
  - Must quote and cite document name and section.
  - Enforced refusal pattern: If information is missing from documents, explicitly respond: *"I couldn't find this information in the available documents."* (No hallucinated SOPs).

#### [NEW] [backend/app/data/sops/](file:///d:/Codes/anticode/project1/backend/app/data/sops/)
- Pre-packaged official operational SOP documents:
  - `SOP-01_Driver_Breakdown_Protocol.md`: Step-by-step procedures for dispatchers when a tractor/trailer breaks down on interstate routes.
  - `SOP-02_Missed_Pickup_And_Detention.md`: Rules for detention billing, 2-hour free time, and carrier reassignment.
  - `SOP-03_Reefer_Temperature_Excursion_And_Claims.md`: Temperature logging requirements, reefer failure escalation, OS&D claims.
  - `SOP-04_HOS_And_Driver_Fatigue.md`: DOT Hours-of-Service limits, mandatory 10-hour rest, sleeper berth rules.
  - `SOP-05_Carrier_Onboarding_And_Safety_Compliance.md`: Minimum safety score (85), insurance requirements ($1M auto liability, $100k cargo).

---

### Component 5: ReAct AI Operations Agent (`/backend/app/services/agent.py`)

#### [NEW] [backend/app/services/agent.py](file:///d:/Codes/anticode/project1/backend/app/services/agent.py)
- Autonomous multi-step operations agent with 7 registered domain tools:
  1. `get_load(load_id)`: Retrieve detailed status, route, and driver for a specific load.
  2. `search_loads(filters)`: Find loads by status, risk level, delay threshold, or carrier.
  3. `get_carrier_performance(carrier_id)`: Get on-time delivery rate, revenue, and fleet reliability.
  4. `get_driver_performance(driver_id)`: Retrieve driver experience, safety rating, and violation history.
  5. `query_analytics(question)`: Run safe analytical data calculations across the system.
  6. `search_knowledge_base(question)`: Search internal SOP documents for procedures and rules.
  7. `predict_load_delay(load_id)`: Run ML prediction + SHAP explanations on a load.
  8. `generate_report(parameters)`: Compile structured operational summary digests.
- Trace logger: Logs each Thought, Action, Tool Input, Observation, and Final Answer so the dispatcher can visually inspect the agent's multi-step reasoning path in the UI.

---

### Component 6: n8n Workflow Automations (`/workflows`)

#### [NEW] [workflows/workflow_a_delayed_load_alert.json](file:///d:/Codes/anticode/project1/workflows/workflow_a_delayed_load_alert.json)
- n8n Workflow: Polls or receives webhooks for loads exceeding 60-minute delay or classified as HIGH risk, queries LLM for impact summary, creates an in-app Alert, and posts to dispatch channels.

#### [NEW] [workflows/workflow_b_daily_ops_report.json](file:///d:/Codes/anticode/project1/workflows/workflow_b_daily_ops_report.json)
- n8n Workflow: Cron scheduled at 07:00 AM daily, executes KPI aggregation queries, invokes AI summary generator, and creates a formatted operations daily briefing.

#### [NEW] [workflows/workflow_c_high_risk_carrier_alert.json](file:///d:/Codes/anticode/project1/workflows/workflow_c_high_risk_carrier_alert.json)
- n8n Workflow: Scheduled carrier health monitor, calculates 14-day rolling late rate, alerts operations manager when any carrier breaches a 15% late delivery threshold.

#### [NEW] [backend/app/services/automation_runner.py](file:///d:/Codes/anticode/project1/backend/app/services/automation_runner.py)
- Integrated Python background runner capable of executing and testing all three workflow triggers directly in the application without requiring an external n8n instance.

---

### Component 7: Management Analytics & Power BI Data Exporter (`/analytics`)

#### [NEW] [analytics/power_bi_export.py](file:///d:/Codes/anticode/project1/analytics/power_bi_export.py)
- Star-schema exporter producing ready-to-import CSV/Excel data feeds for Power BI:
  - `Fact_Loads` (load keys, timestamps, revenue, delay minutes, risk probability)
  - `Dim_Carrier` (carrier demographics, tier, fleet size)
  - `Dim_Driver` (driver experience, safety rating)
  - `Dim_Date` & `Dim_Route`
- Provides Power BI Data Model guidelines, DAX measure formulations (On-Time Delivery %, Total Revenue, Average Revenue per Mile, At-Risk Load Rate), and dashboard layouts.

---

### Component 8: React Web Application (`/frontend`)

The frontend will be built with **Vite**, **React 18**, **Tailwind CSS**, **Lucide Icons**, and **Recharts**.

#### [NEW] [frontend/package.json](file:///d:/Codes/anticode/project1/frontend/package.json)
- React 18, Vite, Tailwind CSS, Lucide React, Recharts, Axios.

#### [NEW] [frontend/src/App.jsx](file:///d:/Codes/anticode/project1/frontend/src/App.jsx)
- Top-level layout with Navigation Bar, Role Switcher (Alex Dispatcher, Sarah Ops Manager, Admin), and tabbed views.

#### [NEW] [frontend/src/pages/DashboardPage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/DashboardPage.jsx)
- Executive KPI cards: Total Loads, Delivered, Delayed, On-Time Delivery %, Total Revenue, Active Carriers.
- Interactive Recharts:
  - Load Volume & Status Breakdown (Bar / Pie)
  - Revenue Trend Over Time (Area Chart)
  - Top Carriers by Volume & On-Time Performance (Horizontal Bar Chart)
  - Real-time Alert notification ticker.

#### [NEW] [frontend/src/pages/CopilotPage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/CopilotPage.jsx)
- AI Copilot Interface:
  - Mode selector: **Natural Language Data Assistant (Text-to-SQL)**, **Knowledge Assistant (RAG SOPs)**, or **Autonomous AI Agent**.
  - Interactive chat stream with message bubbles.
  - Collapsible reasoning drawer: Displays generated SQL queries, execution table results, and RAG document citations.
  - AI Agent Action Trace viewer showing step-by-step tool invocation.

#### [NEW] [frontend/src/pages/LoadsPage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/LoadsPage.jsx)
- Live Loads Management Board:
  - Search by Load ID, Carrier, Origin, Destination.
  - Filter by Status (`In Transit`, `Delayed`, `Delivered`, `High Risk`).
  - Table with origin/destination badges, scheduled vs actual timestamps, and revenue.
  - Click-to-inspect Load Detail Drawer showing delivery events timeline and live ML risk score.

#### [NEW] [frontend/src/pages/PredictionsPage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/PredictionsPage.jsx)
- ML Late Delivery Risk Center:
  - Table of active loads sorted by risk probability.
  - Visual Risk Level pills (`HIGH`, `MEDIUM`, `LOW`).
  - Interactive SHAP Explanation Modal: Shows waterfall/bar breakdown of top contributing risk factors for the selected load.

#### [NEW] [frontend/src/pages/KnowledgeBasePage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/KnowledgeBasePage.jsx)
- SOP Knowledge Base Management:
  - Upload SOP documents (PDF, TXT, MD).
  - Inspect indexed documents and chunk statistics.
  - Direct semantic search sandbox with relevance score display.

#### [NEW] [frontend/src/pages/AlertsPage.jsx](file:///d:/Codes/anticode/project1/frontend/src/pages/AlertsPage.jsx)
- Active Incident & Alert Center:
  - Displays automated alerts from n8n workflows (Delayed loads, high-risk loads, carrier breaches).
  - Severity indicators (Critical, High, Medium, Info).
  - One-click acknowledge and resolve actions.

---

### Component 9: Production Engineering, Docker, & Tests (`/tests`, `/deploy`)

#### [NEW] [docker-compose.yml](file:///d:/Codes/anticode/project1/docker-compose.yml)
- Full stack Docker Compose configuration orchestrating:
  - `postgres`: PostgreSQL 16 with `pgvector` extension
  - `backend`: FastAPI application
  - `frontend`: Vite React build served via Nginx
  - `n8n`: Workflow automation container

#### [NEW] [Dockerfile.backend](file:///d:/Codes/anticode/project1/Dockerfile.backend) & [Dockerfile.frontend](file:///d:/Codes/anticode/project1/Dockerfile.frontend)

#### [NEW] [tests/test_api.py](file:///d:/Codes/anticode/project1/tests/test_api.py)
- Pytest suite verifying:
  - Auth login and JWT verification
  - Loads, carriers, and analytics endpoints
  - Text-to-SQL validation (rejection of malicious queries)
  - RAG knowledge retrieval and refusal on unknown queries
  - ML predictor inference and SHAP factor generation
  - AI Agent tool execution

#### [NEW] [.github/workflows/ci.yml](file:///d:/Codes/anticode/project1/.github/workflows/ci.yml)
- CI pipeline running linting, type checks, and pytest suite.

#### [NEW] [README.md](file:///d:/Codes/anticode/project1/README.md)
- Complete technical documentation: Architecture diagrams, setup instructions, API specs, benchmark results (Manual vs Copilot workflow), and Power BI integration guide.

---

## Verification Plan

### Automated Tests
1. **API & Logic Tests:**
   - Run: `python -m pytest tests/ -v`
   - Validates endpoints, DB queries, SQL safety rules, ML inference, and RAG citations.
2. **ML Model Validation:**
   - Run: `python backend/app/ml/train.py`
   - Generates evaluation report (Accuracy, Precision, Recall, F1, ROC-AUC) and verifies `model.joblib` generation.
3. **Data Platform Verification:**
   - Run: `python backend/app/db/seed_data.py`
   - Verifies generation of 10,000 synthetic loads, carriers, drivers, and events.

### Manual Verification
1. **Frontend UI & Dashboard:**
   - Start backend (`uvicorn app.main:app`) and frontend (`npm run dev`).
   - Navigate through:
     - Dashboard KPIs & Recharts visualization.
     - AI Copilot: Run queries for Text-to-SQL, SOP RAG, and multi-step Agent task.
     - Loads Table: Filter by delayed and high risk loads.
     - Predictions Page: Inspect SHAP contributing factors for a high-risk load.
     - Alerts Page: Acknowledge and resolve an active alert.
