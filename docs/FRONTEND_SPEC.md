# Frontend Spec — Logistics Copilot (no code yet)

Scope: frontend rework only. Backend is done and bug-proof (32/32 pytest). Do not change backend contracts below.

## 1. Stack & structure

- `frontend/`: React 18 + Vite 5 + Tailwind 3 + Recharts + lucide-react. No router (tab state in `src/App.jsx:12-53`).
- Session: `localStorage logix_copilot_session` via `src/lib/api.js:1-33`. `apiFetch` injects `Bearer`, dispatches `auth:expired` on 401 -> logout.
- Tabs: `dashboard / copilot / loads / predictions / knowledge / alerts` (`src/components/Navbar.jsx:13-20`).
- Roles: `dispatcher, viewer` (read + query), `operations_manager, admin` (also upload + trigger workflows). Gate in `App.jsx:29`: `canManageOperations`.

## 2. Backend contracts (verified)

- Base: `/api/v1`. Auth: `POST /auth/login {email,password} -> {access_token,role,user_name,email}`, `GET /auth/me`.
- Demo users: `alex.dispatcher@logistics.copilot/dispatcher123`, `sarah.manager@logistics.copilot/manager123`, `admin@logistics.copilot/admin123`, `viewer@logistics.copilot/viewer123`.
- Loads: `GET /loads?status&search&carrier_id&limit(1-200)&offset`, `GET /loads/stats/summary`, `GET /loads/{id}` (+`delivery_events`).
- Carriers/drivers: `GET /carriers?search&status&limit&offset`, `GET /carriers/{id}`, `GET /carriers/{id}/performance`, `GET /drivers?...`, `GET /drivers/{id}`.
- Analytics: `GET /analytics/kpis`, `/carrier-performance?limit`, `/revenue-trends` (14d), `/lane-trends` (top 8).
- Predictions: `GET /predictions/load/{load_id} -> {late_probability,risk_level,confidence_score,top_contributing_factors[],model_version}`, `GET /predictions/batch/high-risk?limit(1-20)`.
- Alerts: `GET /alerts?status(active|all)&alert_type(all|delayed_load|daily_ops_report|high_risk_carrier|...)`, `POST /alerts/{id}/resolve`, `POST /alerts/trigger/{workflow_a|workflow_b|workflow_c|delayed_load|daily_report|carrier_breach}`.
- AI: `POST /copilot/query {query,mode}`, `POST /rag/query`, `GET /rag/documents`, `POST /rag/upload (FormData, manager/admin only, .md/.txt/.pdf 10MB)`, `POST /agent/chat {query} -> {final_answer,action_traces[],tools_used[]}`.
- Rules: OTD = `delivered/(delivered+delayed)` everywhere. Risk `HIGH>=0.65/MED>=0.30`. `model_version` is dynamic (currently `random-forest-v1.0`) — never hardcode `XGBoost-v1.0`.

## 3. Pages

### 3.1 Login (`LoginPage.jsx`)
- Keep: email+password, inline error, `saveSession->onLogin`.
- Rework must: remove prefilled demo creds (or move to dev-only hint), loading state, no signup/refresh, 401 message.

### 3.2 Dashboard (`DashboardPage.jsx`)
- Data: parallel `kpis, revenue-trends, carrier-performance?limit=6, lane-trends`. Props `setActiveTab` for cross-links to alerts/loads.
- Must show: 6 KPI cards (total/delivered/delayed/in-transit/revenue/active carriers), AreaChart revenue+loads, BarChart carrier OTD%, lane table with `delay_rate>18` badge.
- Fix: remove hardcoded fallbacks (`10,000/91.4%/...`), remove static `3 breaches` banner, add loading/skeleton, empty, error states.

### 3.3 AI Copilot (`CopilotPage.jsx`)
- 3 modes: `agent->/agent/chat`, `text_to_sql->/copilot/query`, `rag->/rag/query`. Sample chips per mode, history stack.
- Render: agent `action_traces{step,thought,action,action_input,observation}+final_answer`; SQL `explanation+generated_sql+columns/rows+execution_time_ms+row_count` (+ fallback `[Note:...]` prefix); RAG `answer+citations{document_name,section,snippet}`.
- Must: surface backend fallback note, no fake counts.

### 3.4 Load Board (`LoadsPage.jsx`)
- Data: `GET /loads?limit&status&search&offset`, row click `GET /loads/{id}`, drawer button `GET /predictions/load/{id}`.
- Must: status chips `all/delayed/in_transit/delivered/pending`, search (debounced, not Enter-only), pagination (`limit/offset`, default 50 max 200), drawer with route, carrier/driver (`carrier_name/driver_name`), SHAP list, `delivery_events` timeline.

### 3.5 Risk Center (`PredictionsPage.jsx`)
- Data: `GET /predictions/batch/high-risk?limit`.
- Must: card grid `load_number,late_probability,risk_level,top_factors[0]`, modal `confidence_score+factor_name+importance+impact_description`. Show `model_version` from API, not hardcoded pill. Empty state if none.

### 3.6 SOP Knowledge Base (`KnowledgeBasePage.jsx`)
- Data: `GET /rag/documents`, `POST /rag/query` sandbox, `POST /rag/upload` gated by `canUpload`.
- Must: table `name,file_type,chunk_count,file_size,uploaded_by`, `accept=.md,.txt,.pdf`, upload progress + 400/403/409/413 messages (not `console.error`), manager/admin-only button hidden otherwise.

### 3.7 Incident Center (`AlertsPage.jsx`)
- Data: `GET /alerts?status&alert_type`, `POST /alerts/{id}/resolve`, `POST /alerts/trigger/{workflow_a|b|c}` (alias `delayed_load/daily_report/carrier_breach` also valid).
- Must: status filter `active/all`, type filter (hide `daily_ops_report` by default or separate tab), resolve button with confirm, trigger panel hidden if `!canTriggerWorkflows`, show `already_generated` for daily report, raw JSON only in dev details.

### 3.8 Navbar + Footer
- Navbar: 6 tabs, live `GET /analytics/kpis` pill, `session.user_name/role` + logout, mobile grid. Must: active state, 401 logout, no dead links.
- Footer: keep platform + API version, remove hardcoded `10,000 Loads Indexed` (use live KPI or drop).

## 4. Cross-cutting rework checklist

- No hardcoded model names, KPIs, banners. All labels from API.
- `limit/offset` pagination everywhere (loads, carriers, alerts). Cap batch `limit<=20`.
- Debounced search, loading skeletons, empty states, inline API errors (401/403/404/422/500).
- Deep-linkable tabs (`?tab=loads`) or keep state but document.
- Remove Google Fonts hard dependency for offline (system fallback).
- No secrets in frontend. No `fetch` bypassing `apiFetch` except login.
- Carriers/drivers pages are API-ready but unused in UI — decide: add tabs or keep hidden (backend supports).

## 5. Acceptance (frontend done)

- Login as dispatcher/viewer/manager works, 401 expires to login, viewer cannot see upload/trigger.
- Dispatcher can: KPI -> high-risk load -> SHAP -> cited SOP -> resolve alert -> logout, all live data, no console errors.
- `vite build` passes. No backend changes needed.
