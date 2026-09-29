# AI Logistics Operations Copilot

> **An enterprise-grade, AI-powered operations copilot for US freight, trucking, and supply chain logistics.**  
> Built to eliminate manual document searching, fragmented spreadsheets, and reactive delay troubleshooting.

---

## 1. System Architecture

```
                               ┌────────────────────────────────────────────────┐
                               │           React + Vite Frontend (UI)          │
                               │  - Operations Dashboard & Recharts KPIs       │
                               │  - AI Copilot (Text-to-SQL + RAG + Agent)     │
                               │  - Live Load Board & Tracking Timeline        │
                               │  - ML Delay Risk & SHAP Factor Modal          │
                               │  - SOP Knowledge Base & Document Manager      │
                               │  - Alerts & Incident Management Center        │
                               └───────────────────────┬────────────────────────┘
                                                       │ REST API / JWT
                                                       ▼
                               ┌────────────────────────────────────────────────┐
                               │               FastAPI Backend Core             │
                               │  - Auth (JWT, Native Bcrypt, Personas)         │
                               │  - Loads / Carriers / Drivers / Analytics APIs │
                               │  - Audit Logging & Table Whitelisting          │
                               └───────┬──────────────┬───────────────┬─────────┘
                                       │              │               │
            ┌──────────────────────────┼──────────────┼───────────────┴───────────────┐
            │                          │              │                               │
            ▼                          ▼              ▼                               ▼
  ┌───────────────────┐      ┌──────────────────┐   ┌───────────────────┐   ┌───────────────────┐
  │   AI Assistant    │      │    RAG Engine    │   │     AI Agent      │   │    ML Service     │
  │ (Text-to-SQL)     │      │ (SOPs & Vectors) │   │ (Tool-Calling)    │   │ (XGBoost + SHAP)  │
  │ - AST Validator   │      │ - Semantic Sim   │   │ - ReAct Loop      │   │ - Risk Classifier │
  │ - Safe Read-Only  │      │ - Cosine Chunks  │   │ - 7 Domain Tools  │   │ - Factor Ranker   │
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

## 2. Core Functional Modules (MVP)

1. **Logistics Data Platform (`backend/app/db/`)**:
   - 12 comprehensive operational entities: `users`, `customers`, `carriers`, `drivers`, `trucks`, `loads`, `shipments`, `delivery_events`, `invoices`, `compliance_records`, `documents`, and `alerts`.
   - Realistic synthetic logistics dataset (10,000 loads spanning 90 days, 500 carriers with varied performance tiers, 2,000 drivers, 1,000 trucks, 20,000+ delivery events).
   - Seamless dual-database support: connects to PostgreSQL with `pgvector` when present, with automatic zero-friction fallback to local SQLite.

2. **Machine Learning Delay Prediction & SHAP Engine (`backend/app/ml/`)**:
   - Compares Logistic Regression, Random Forest, and XGBoost classifiers.
   - **Performance:** **0.9772 Accuracy**, **1.000 Precision**, **0.8562 Recall**, **0.9225 F1-Score**, and **0.9512 ROC-AUC**.
   - Model and SHAP TreeExplainer pre-computed and serialized for sub-millisecond inference.
   - Translates raw SHAP math into actionable dispatcher explanations (e.g., *"Origin Pickup Delay adds +42% delay risk"*).

3. **Safe Read-Only Text-to-SQL Copilot (`backend/app/services/text_to_sql.py`)**:
   - AST validation rejecting any destructive statement (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `EXEC`).
   - Table whitelisting strictly protecting sensitive internal tables like `users` password hashes.
   - Automatically injects schema context and synthesizes natural language executive answers.

4. **Vector RAG Knowledge Assistant (`backend/app/services/rag.py`)**:
   - Grounded vector semantic search over 5 official company SOPs:
     - `SOP-01_Driver_Breakdown_Protocol.md`
     - `SOP-02_Missed_Pickup_And_Detention.md`
     - `SOP-03_Reefer_Temperature_Excursion_And_Claims.md`
     - `SOP-04_HOS_And_Driver_Fatigue.md`
     - `SOP-05_Carrier_Onboarding_And_Safety_Compliance.md`
   - Strict citation enforcement with explicit refusal (*"I couldn't find this information in the available documents."*) preventing SOP hallucinations.

5. **Autonomous ReAct Operational AI Agent (`backend/app/services/agent.py`)**:
   - Multi-step tool-calling agent with 7 controlled domain actions (`search_loads`, `get_load`, `get_carrier_performance`, `get_driver_performance`, `predict_load_delay`, `search_knowledge_base`, `generate_report`).
   - Transparent step-by-step visual execution trace logging (Thought, Action, Action Input, Observation, Final Answer).

6. **Workflow Automation (`workflows/`)**:
   - Ready-to-import n8n workflow definitions:
     - `workflow_a_delayed_load_alert.json`: Transit delay escalation.
     - `workflow_b_daily_ops_report.json`: Daily 07:00 AM KPI rollup briefing.
     - `workflow_c_high_risk_carrier_alert.json`: 14-day rolling late rate threshold monitor.
   - Native Python runner (`backend/app/services/automation_runner.py`) for instantaneous in-app testing.

7. **Power BI Dimensional Star-Schema (`analytics/`)**:
   - Pre-built exporter producing `Fact_Loads.csv`, `Dim_Carrier.csv`, `Dim_Driver.csv`, `Dim_Customer.csv`, and `Dim_Route.csv`.
   - Comprehensive DAX formulation guide for On-Time Delivery %, Revenue per Mile, and Delay Frequency.

8. **Modern React Web Dashboard (`frontend/`)**:
   - Built with Vite, React 18, Tailwind CSS, Lucide Icons, and Recharts.
   - Pages:
     - **Operations KPI Dashboard**: Executive KPI cards, 14-day revenue area chart, carrier performance bar chart, interstate corridor heatmap.
     - **AI Copilot**: 3-in-1 multi-mode interface (Text-to-SQL, SOP RAG, ReAct Agent) with reasoning drawer and prompt chips.
     - **Load Board**: Live filterable dispatches with slide-over detail drawer and real-time XGBoost delay risk evaluation.
     - **ML Delay Risk Center**: Visual late probability progress meters and interactive SHAP factor attribution modal.
     - **SOP Knowledge Base**: Semantic search sandbox, chunk viewer, and document uploader.
     - **Incident Center**: Active alert feed with one-click resolution and manual workflow trigger triggers.

---

## 3. Quickstart Guide

### Prerequisites
- Python 3.10 or 3.11
- Node.js 18+ and npm

### Local Development Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# Seed 10,000 synthetic records
python app/db/seed_data.py 10000

# Train XGBoost model and serialize SHAP explainer
python app/ml/train.py

# Run FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:5173`.

#### 3. Default Login Personas
- **Alex (Dispatcher):** `alex.dispatcher@logistics.copilot` / `dispatcher123`
- **Sarah (Operations Manager):** `sarah.manager@logistics.copilot` / `manager123`
- **Admin:** `admin@logistics.copilot` / `admin123`

---

## 4. Docker Deployment

Orchestrate the entire platform (PostgreSQL + pgvector, FastAPI, React, and n8n) with a single command:

```bash
docker compose up --build
```

- **Frontend Application:** `http://localhost:5173`
- **FastAPI Core:** `http://localhost:8000`
- **n8n Automation Console:** `http://localhost:5678`

---

## 5. Automated Test Suite

Run the full pytest suite:

```bash
pytest tests/ -v
```

All 14 unit and integration tests validate authentication, load filtering, carrier metrics, XGBoost inference, SQL guardrails, vector RAG retrieval, and AI agent traces.
