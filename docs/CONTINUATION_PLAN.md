# AI Logistics Operations Copilot — Continuation Plan

**Purpose:** Continue the project in clear phases without writing code in this planning stage.  
**Current state:** Demo-ready functional MVP with major production-readiness gaps.  
**Guiding principle:** Stabilize and secure the existing product before adding scope or redesigning the UI.

## Current phase status

| Phase | Status | Current position |
|---|---|---|
| Phase 0 — Baseline and decisions | **Complete** | Local tests, builds, backend health, KPI, and login checks passed; see `BASELINE_VERIFICATION.md`. |
| Phase 1 — Usable MVP | **In progress** | Login/session handling, JWT-protected APIs, role-gated actions, and Docker API proxy are implemented. Full Docker runtime verification remains blocked because Docker is not installed locally. |
| Phase 2 — Security, data integrity, and reliability | **Complete** | Secure configuration, versioned schema bootstrap, audit logs, SQL limits/timeouts, upload hardening with optional fail-closed ClamAV scanning, and backup/recovery procedures are implemented. PostgreSQL, Docker, and ClamAV runtime verification move to Phase 5 staging work. |
| Phase 3 — Automations, analytics, and AI quality | **In progress** | Secure n8n service-token support, 14-day carrier-risk logic, daily-report idempotency, and model-version alignment are implemented. External notification, Power BI, LLM, and staging validation need user-provided configuration. |
| Phase 4 — UI/UX redesign | Not started | Deliberately deferred until workflow and permissions are stable. |
| Phase 5 — Deployment and operations | Not started | Docker configuration is improving, but staging/deployment work is not yet started. |
| Phase 6 — Pilot, measurement, and roadmap | Not started | Requires a deployable, validated staging release. |

## Delivery sequence

```text
Phase 0: Confirm baseline
        ↓
Phase 1: Make the current MVP usable end-to-end
        ↓
Phase 2: Security, data integrity, and reliability
        ↓
Phase 3: Automations, analytics, and AI quality
        ↓
Phase 4: UI/UX redesign
        ↓
Phase 5: Deployment and operations
        ↓
Phase 6: Pilot and future roadmap
```

## Phase 0 — Baseline and decisions

### Goal

Establish a known-good starting point and make the product decisions that affect all later phases.

### Work

- Set up a project Python environment and install the declared backend dependencies.
- Run the existing API tests, database seed process, ML training process, backend startup, and frontend build.
- Record which checks pass, fail, or need changes.
- Decide the initial environment strategy:
  - local development: SQLite is acceptable;
  - shared/staging/production: PostgreSQL should be the source of truth.
- Choose the first target deployment environment (for example, a staging server or cloud provider).
- Decide which user roles are actually required for the first release: dispatcher, operations manager, and administrator are already represented in the product concept.
- Confirm which notification channel will be used for real alerts: email, Slack, Microsoft Teams, or another approved operational tool.
- Reconcile public documentation and product claims, especially the model-selection statement (Random Forest versus XGBoost).

### Deliverables

- A short baseline verification record.
- A chosen database/deployment/notification approach.
- A prioritized issue list derived from the current status report.

### Exit criteria

- The team can start the current backend and frontend locally.
- The test baseline is known and reproducible.
- No major platform choice remains ambiguous for Phase 1.

## Phase 1 — Complete the usable MVP

### Goal

Make the current application work as a coherent product for a real internal user—not just as independently functioning pages and APIs.

### Work

- Add a real frontend login, logout, session persistence, and session-expiry experience.
- Connect the frontend to the existing JWT authentication API.
- Ensure each API request uses the authenticated session where required.
- Protect backend endpoints with user authentication and role checks.
- Replace the cosmetic role selector with identity/permissions derived from the signed-in user.
- Verify all key user flows from the PRD:
  - login;
  - view dashboard KPIs;
  - search and inspect loads;
  - use Text-to-SQL;
  - search SOPs and inspect citations;
  - use the operations agent;
  - view risk predictions and SHAP explanations;
  - inspect, trigger, and resolve alerts.
- Standardize loading, empty, error, and retry states in every frontend page.
- Add clear navigation and page-level permissions where needed.

### Deliverables

- An end-to-end authenticated MVP user journey.
- A role/permission matrix for dispatcher, manager, and administrator.
- A manual acceptance-test checklist covering each core flow.

### Exit criteria

- A dispatcher and an operations manager can complete their relevant tasks from login to logout.
- Unauthenticated users cannot access protected operational data or actions.
- All core screens handle backend errors gracefully.

## Phase 2 — Security, data integrity, and reliability

### Goal

Make the application safe enough for a shared staging environment and prevent avoidable data/security failures.

### Implemented so far

- **JWT secret hardening:** The application no longer ships a fixed default JWT secret. Local development receives a process-generated secret when none is supplied; Docker deployments require `SECRET_KEY` through environment configuration.
- **CORS restriction:** Removed the wildcard (`*`) allowed origin. Local frontend origins remain explicitly listed.
- **Safer local database behavior:** SQLite is now the default local database. PostgreSQL is selected only when `DATABASE_URL` is explicitly provided, avoiding failed PostgreSQL connection attempts during normal local work.
- **Docker secret handling:** PostgreSQL credentials, backend JWT secret, and n8n credentials/encryption key are no longer hard-coded in Compose. `.env.example` documents the required variables, while `.gitignore` prevents `.env` secrets from being committed.
- **n8n protection:** Docker Compose enables n8n basic authentication and requires an n8n encryption key for stored credentials.
- **Document upload authorization:** Only operations managers and administrators can upload SOP/knowledge documents.
- **Document upload validation:** Uploads accept only Markdown, text, and PDF files; reject empty files, duplicate names, unsafe filenames, and files larger than 10 MB.
- **PDF extraction and storage isolation:** PDF text is actually extracted before indexing, and user-uploaded files are stored separately from the official SOP directory to prevent overwrites.
- **Regression coverage:** Tests now verify upload authorization and invalid-file rejection, in addition to API authentication and workflow role permissions.
- **Versioned schema baseline:** Startup applies the `schema_migrations` baseline and creates missing tables, including the audit-log table.
- **Sensitive-action audit trail:** Successful sign-ins, SQL Copilot activity, RAG queries, agent tasks, uploads, alert resolution, and workflow triggers are recorded in `audit_logs` without storing raw AI prompts.
- **SQL execution controls:** Queries are limited by length and result size; PostgreSQL sessions apply a statement timeout before executing approved SQL.
- **Fail-closed scanning integration:** Production can require ClamAV scanning through environment settings; a scan outage blocks uploads rather than accepting an unscanned file.
- **Operations runbook:** `OPERATIONS_RUNBOOK.md` defines schema initialization, PostgreSQL backup/restore, document scanning, audit-log review, and incident-response procedures.

### Still remaining

- Verify PostgreSQL backup/restore, Docker startup, and ClamAV scanning in a staging environment during Phase 5.
- Add scheduled dependency/security scanning and operational log aggregation when CI/CD and monitoring are introduced in Phase 5.

### Work

- Remove hard-coded fallback secrets and require secrets through environment configuration.
- Restrict CORS to approved frontend origins.
- Define password rules, session duration, token refresh/logout behavior, and account-access policy.
- Add server-enforced role-based access control for all sensitive reads and actions.
- Introduce database migrations and a repeatable database initialization process.
- Separate synthetic-data seeding from normal application startup.
- Set safe document upload rules:
  - permitted file formats;
  - file-size limits;
  - filename sanitization;
  - virus/malware scanning approach if external files are allowed;
  - real PDF text extraction;
  - an audit record for each upload.
- Strengthen Text-to-SQL protections with query limits, timeout limits, audit trails, and explicit tests for bypass attempts.
- Define backup, restore, retention, and data-access policies for PostgreSQL.

### Deliverables

- A security configuration checklist.
- Database migration strategy and recovery procedure.
- Document-upload policy.
- An authorization and security test suite.

### Exit criteria

- No development secrets or permissive production settings are shipped.
- Database setup and upgrades are repeatable without reseeding production data.
- Uploaded content is validated before indexing.
- Sensitive actions and access are authenticated, authorized, and auditable.

## Phase 3 — Automations, analytics, and AI quality

### Goal

Turn the existing demo intelligence features into measurable, dependable operational capabilities.

### Implemented so far

- Scheduled n8n workflow calls can authenticate with a dedicated `WORKFLOW_API_TOKEN`, separate from human JWT sessions.
- Workflow A and Workflow B now call the guarded backend runner directly, avoiding unprotected intermediary API calls.
- The daily operations briefing is idempotent: rerunning it on the same day returns the existing report rather than generating duplicates.
- Carrier-risk assessment now calculates the late rate across delivered/delayed loads in a rolling 14-day window based on the newest available operations data.
- The prediction API derives the reported model version from the saved benchmark artifact, eliminating the previous hard-coded XGBoost label when another model was selected.
- `AI_QUALITY_EVALUATION.md` defines acceptance targets, test-set requirements, review procedures, and model-governance expectations.

### Still needed from the project owner

- Notification provider/channel, recipients, and credentials.
- Daily reporting timezone and final schedule.
- Power BI workspace/report or confirmation that the existing CSV exports are the intended delivery format.
- Chosen live AI provider, approved model, and credentials, if the offline demo fallback is not sufficient.
- Representative staging data and a staging PostgreSQL/n8n environment to verify integrations end to end.

### Confirmed decisions

- Future notifications will use Slack in `#logistics-ops`; setup is deferred and no Slack connection has been created.
- The daily operations report is scheduled for 07:00 Monday–Friday in `America/New_York`.
- Existing CSV exports are sufficient for Power BI at this stage.
- OpenAI `gpt-4o-mini` is the selected AI provider/model; the app remains in offline fallback mode until an API key is supplied securely.
- PostgreSQL and n8n staging validation is deferred to Phase 5.

### Work

#### Workflow automation

- Configure n8n with authentication and persistent credentials.
- Connect workflows to the chosen notification channel.
- Confirm schedules for delayed-load monitoring, daily operations reporting, and carrier-risk monitoring.
- Correct carrier risk calculation to use the intended 14-day window.
- Add idempotency to prevent duplicate alerts.
- Define retries, failure alerts, escalation rules, and workflow ownership.
- Test workflows against realistic success, failure, and duplicate-event scenarios.

#### Analytics and Power BI

- Confirm the reporting data model and ownership of each KPI definition.
- Automate scheduled Power BI export/refresh.
- Create a first usable Power BI report or semantic model from the existing star-schema exports.
- Reconcile KPI calculations between backend dashboard, automation reports, and Power BI.

#### AI and ML quality

- Define an evaluation set for Text-to-SQL, RAG, agent tasks, and delay-risk predictions.
- Test AI answers for accuracy, citation quality, harmful actions, and failure behavior.
- Make model naming and benchmark documentation consistent with the selected deployed model.
- Add model versioning, decision thresholds, calibration review, and retraining criteria.
- Define guardrails for when an agent may recommend an action versus when it may execute an action.

### Deliverables

- Connected, scheduled, and monitored automation workflows.
- A Power BI reporting artifact or automated refresh pipeline.
- AI/ML evaluation scorecard and model governance note.

### Exit criteria

- Alert workflows run on schedule and do not create duplicate notifications.
- KPI values agree across the web app, daily report, and Power BI.
- AI features have documented quality checks and safe failure behavior.

## Phase 4 — UI/UX redesign

### Goal

Replace the current prototype-style interface with a polished, operationally efficient product experience.

### Work

- Start with a lightweight discovery pass with dispatchers and operations managers.
- Identify the highest-frequency workflows and information each role needs first.
- Create a design direction and component system: typography, colors, spacing, cards, data tables, charts, severity states, and responsive behavior.
- Redesign the primary journeys before secondary pages:
  1. dashboard and attention queue;
  2. load board and load detail;
  3. alert triage and resolution;
  4. AI Copilot;
  5. predictions and SOP knowledge base.
- Improve data density, filtering, sorting, keyboard usability, accessibility, and mobile/tablet behavior.
- Clearly distinguish live system data, estimates, AI recommendations, and simulated/demo content.
- Add user feedback mechanisms for AI answers, predictions, and alert usefulness.

### Deliverables

- Approved wireframes or design prototypes.
- A reusable frontend design system.
- Usability-test findings and prioritized UI improvements.

### Exit criteria

- The redesigned product supports the main dispatcher flow with fewer clicks and clearer prioritization.
- Users can understand severity, ownership, status, and recommended next action at a glance.
- The interface meets baseline accessibility and responsive-design standards.

## Phase 5 — Deployment and operations

### Goal

Create a reliable staging deployment, then a controlled production release process.

### Work

- Fix Docker end-to-end routing so the frontend can reach the backend in the Compose environment.
- Configure health and readiness checks for frontend, backend, database, and automation services.
- Use PostgreSQL for staging/production and validate schema migrations.
- Add container restart policies, persistent volumes, backups, and restore testing.
- Add structured application logs, request IDs, error reporting, metrics, and service dashboards.
- Add CI checks for tests, frontend build, linting, type checks, security scanning, and dependency review.
- Define CD steps: build, test, deploy to staging, approve, deploy to production, and rollback.
- Configure TLS, domain routing, access controls, secrets management, and environment-specific settings.
- Write an operational runbook covering incidents, database recovery, workflow failures, and model rollback.

### Deliverables

- Working staging environment.
- Production deployment plan and rollback procedure.
- Monitoring dashboard and incident runbook.

### Exit criteria

- A clean deployment can be performed without manual database repair.
- A service failure is visible through monitoring and recoverable through documented steps.
- Staging validates the same deployment path intended for production.

## Phase 6 — Pilot, measurement, and roadmap

### Goal

Validate value with real users and expand only where evidence supports it.

### Work

- Run a controlled pilot with selected dispatch and operations users.
- Track the metrics defined in the PRD:
  - time saved locating shipment/SOP information;
  - on-time delivery and delay-management performance;
  - alert precision and response time;
  - RAG answer usefulness and citation correctness;
  - prediction precision/recall in live operations;
  - adoption and repeat usage by role.
- Collect qualitative feedback on the UI, automation trust, and AI accuracy.
- Prioritize V2 items based on measurable value. Likely candidates include live integrations with TMS/ELD/GPS systems, real-time tracking, collaborative incident workflows, richer role management, and enhanced forecasting.
- Review compliance, privacy, and customer-data requirements before connecting live external data.

### Deliverables

- Pilot results and decision log.
- Measured business case for expansion.
- V2 roadmap ranked by impact, effort, and risk.

### Exit criteria

- The team has evidence that the product improves at least one important operations metric.
- Future development is guided by pilot data rather than feature assumptions.

## Suggested priority order

| Priority | Work item | Why it comes first |
|---|---|---|
| P0 | Baseline verification and dependency setup | Establishes whether the current system truly works as claimed |
| P0 | Frontend login, JWT use, API protection | Closes the largest usability and security gap |
| P0 | Docker frontend-to-backend routing | Required for a complete deployable stack |
| P0 | Secrets, CORS, n8n security, upload validation | Removes unsafe defaults before shared use |
| P1 | Migrations, PostgreSQL staging, backups | Makes data durable and deployment repeatable |
| P1 | Workflow scheduling, notifications, idempotency | Makes automation operational rather than demonstrative |
| P1 | Test expansion and CI quality gates | Reduces regression risk |
| P2 | UI/UX redesign | Maximizes usability once core behavior is stable |
| P2 | Power BI report/refresh pipeline | Completes management analytics delivery |
| P2 | Pilot and V2 integrations | Best decided after real user feedback |

## Scope guardrails

- Do not integrate live customer or carrier data until access control, auditability, backups, and privacy requirements are accepted.
- Do not let the AI agent perform irreversible external actions without a human approval step.
- Do not redesign the UI before the core login, permissions, and data/error states are settled.
- Do not treat synthetic-data ML results as production performance; validate on representative real data before operational reliance.

## Definition of a successful next release

The next release should be considered successful when an authenticated dispatcher can log in, identify and inspect a delayed/high-risk load, use cited SOP guidance and a database-backed AI answer, resolve or escalate an alert, and log out—while the system safely records the activity and runs reliably in a repeatable staging environment.
