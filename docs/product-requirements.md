# Product Requirements Document
## AI Logistics Operations Copilot

**Version:** 1.0  
**Product Type:** AI-powered logistics operations platform  
**Target Role Alignment:** AI Engineer / AI & Automation Engineer  
**Build Constraint:** Free / open-source tooling wherever possible  
**MVP Philosophy:** Working end-to-end product over feature quantity

---

# 1. Problem Statement

## Problem

US freight and trucking operations generate large volumes of operational data across loads, carriers, drivers, deliveries, invoices, compliance records and internal SOPs.

Operations teams frequently need to answer questions such as:

- Which loads are currently at risk?
- Which carriers are consistently underperforming?
- Why are deliveries being delayed?
- What revenue was generated this week?
- Which drivers or carriers require attention?
- What is the correct procedure for a particular operational issue?
- Can today's operational report be generated automatically?

Today, answering these questions often requires switching between spreadsheets, databases, dashboards, internal documents and communication tools.

This creates three problems:

1. **Slow decision-making** — employees spend time finding and combining information instead of acting on it.
2. **Repetitive manual work** — reports, alerts and operational checks are repeatedly performed by humans.
3. **Knowledge fragmentation** — SOPs and operational knowledge are difficult to search consistently.

## Product Opportunity

Build an internal **AI Logistics Operations Copilot** that combines:

**Operational Data + Machine Learning + LLMs + RAG + AI Agents + Workflow Automation + Analytics**

into one system.

The product should allow an operations employee to ask questions in natural language, retrieve relevant company knowledge, identify operational risks, automate repetitive workflows and monitor business KPIs.

## Core Product Principle

> The AI should assist operations employees, not autonomously make high-impact business decisions.

For MVP, the system can **recommend, analyze, summarize and alert**, but humans remain responsible for operational decisions.

---

# 2. Target User + 2 Personas

## Primary Target User

**US freight/logistics operations staff**, especially dispatch and operations personnel.

Secondary users are operations managers and management.

---

## Persona 1 — Alex, Dispatcher

**Role:** Freight Dispatcher  
**Experience:** 1–3 years  
**Primary goal:** Keep loads moving on time.

### Problems

- Monitors many loads simultaneously.
- Manually checks delayed shipments.
- Needs carrier information quickly.
- Frequently searches SOPs.
- Spends time preparing status reports.

### Needs

Alex wants to ask:

> "Which loads are likely to be late today?"

Instead of manually checking multiple records.

Alex also wants:

> "What is the procedure when a carrier misses pickup?"

The system should retrieve the relevant SOP and provide a concise answer with its source.

### Success for Alex

Reduce time spent on:

- load monitoring
- searching documentation
- preparing reports
- identifying problematic carriers

---

# Persona 2 — Sarah, Operations Manager

**Role:** Logistics Operations Manager  
**Experience:** 5+ years  
**Primary goal:** Improve operational performance.

### Problems

- Needs regular KPI reports.
- Manually investigates poor carrier performance.
- Wants visibility into revenue and delivery performance.
- Needs early warning about operational problems.

### Needs

Sarah wants:

> "Show me the five carriers with the worst on-time delivery rate this month."

She also wants automated reports such as:

> "Send me today's operations summary every morning."

### Success for Sarah

Sarah should be able to understand the state of operations within minutes rather than manually compiling information from multiple systems.

---

# 3. Goals and Non-Goals

## Goals

### G1 — AI Operations Assistant

Allow users to query logistics data using natural language.

Example:

> "How many loads were delayed last week?"

The system translates the request into a safe database query and returns an understandable answer.

---

### G2 — Logistics Knowledge Assistant

Build a RAG system capable of answering questions from internal logistics documents.

Example:

> "What should a dispatcher do when a driver reports a breakdown?"

The answer must be grounded in uploaded documentation.

---

### G3 — AI Agent

Create an AI agent capable of selecting appropriate tools to complete multi-step operational tasks.

Example:

> "Find high-risk loads and prepare an operations summary."

---

### G4 — Predictive Analytics

Predict the probability that a load will be delivered late.

The model should provide:

- risk probability
- risk classification
- important contributing factors

---

### G5 — Workflow Automation

Use n8n to automate repetitive workflows.

Examples:

- delayed-load alerts
- daily operational reports
- high-risk carrier notifications

---

### G6 — Management Analytics

Provide Power BI dashboards covering:

- revenue
- loads
- delivery performance
- carrier performance
- driver performance
- operational trends

---

### G7 — Production-Style Engineering

The completed project should include:

- API documentation
- authentication
- database migrations
- testing
- logging
- Docker
- CI/CD
- security controls
- architecture documentation
- deployment
- monitoring

---

## Non-Goals

The MVP will **not**:

- autonomously dispatch trucks
- negotiate freight rates
- automatically assign real-world loads
- replace human dispatchers
- make financial decisions
- communicate with real carriers
- directly control ELD/TMS systems
- provide legal/compliance advice
- use sensitive real company data

These can become future integrations.

---

# 4. User Stories

## AI Assistant

- **As a dispatcher, I want to ask questions about loads in natural language so that I can find operational information quickly.**

- **As an operations manager, I want to query carrier performance so that I can identify underperforming carriers.**

- **As a manager, I want AI-generated summaries of operational data so that I can understand trends without manually analyzing tables.**

---

## Knowledge Assistant

- **As a dispatcher, I want to ask questions about company SOPs so that I can find the correct procedure quickly.**

- **As an employee, I want answers to include their source document so that I can verify the information.**

- **As an administrator, I want to upload operational documents so that the knowledge base stays current.**

---

## AI Agent

- **As an operations manager, I want an AI agent to use logistics tools so that multi-step analysis can be performed automatically.**

- **As a dispatcher, I want the agent to identify high-risk loads so that I can prioritize my work.**

- **As a manager, I want the agent to generate operational reports so that I don't manually compile them.**

---

## Machine Learning

- **As a dispatcher, I want to know which loads have a high probability of late delivery so that I can intervene early.**

- **As a manager, I want to understand why a load is considered high-risk so that I can make informed decisions.**

---

## Automation

- **As an operations manager, I want delayed-load alerts generated automatically so that important problems are not missed.**

- **As a manager, I want a daily operations report generated automatically so that I receive consistent KPI information.**

---

## Analytics

- **As a manager, I want to see revenue and operational KPIs in a dashboard so that I can monitor business performance.**

- **As a carrier manager, I want carrier performance metrics so that I can identify reliable and unreliable carriers.**

---

# 5. Feature List

## MVP

### F1 — Logistics Data Platform
- PostgreSQL database
- Synthetic logistics dataset
- Data ingestion
- CRUD APIs
- Database validation

### F2 — Operations Dashboard
- Load KPIs
- Revenue
- Delivery performance
- Carrier performance
- Driver performance
- Power BI integration

### F3 — AI Data Assistant
- Natural-language questions
- SQL generation
- SQL validation
- Database execution
- Natural-language response

### F4 — RAG Knowledge Assistant
- Document upload
- Document processing
- Chunking
- Embeddings
- Vector search
- Source-aware answers

### F5 — AI Agent
- Tool calling
- Load lookup
- Carrier analysis
- Driver analysis
- SQL analysis
- Knowledge search
- Report generation

### F6 — Late Delivery Prediction
- Feature engineering
- Classification model
- Risk score
- SHAP explanations

### F7 — n8n Automation
- Delayed-load workflow
- Daily report workflow
- High-risk load alert

### F8 — Web Application
- React frontend
- Login
- Chat interface
- Dashboard
- Alerts
- Knowledge base

### F9 — Production Engineering
- Docker
- Tests
- API documentation
- Logging
- CI/CD
- Environment configuration
- Basic security

---

## V2

- Real-time event simulation
- Advanced agent workflows
- Automated report generation
- Email integration
- Slack/Teams integration
- Advanced carrier scoring
- Conversational dashboard analysis
- Human approval workflows
- Role-based access control
- Audit logs
- Model monitoring

---

## Later

- Real TMS integration
- Real ELD integration
- Real-time GPS/telematics
- Freight-rate prediction
- Automated load matching
- Carrier recommendation engine
- Voice-based dispatcher assistant
- Predictive maintenance
- Autonomous workflow execution
- Multi-company SaaS architecture

---

# 6. Detailed Functional Requirements — MVP

## F1. Logistics Data Platform

### FR-1.1 Database

System must use PostgreSQL.

Minimum entities:

- customers
- carriers
- drivers
- trucks
- loads
- shipments
- delivery_events
- invoices
- compliance_records
- documents
- users
- alerts

---

### FR-1.2 Data Generation

Create realistic synthetic logistics data.

Recommended initial scale:

- 10,000 loads
- 500 carriers
- 2,000 drivers
- 1,000 trucks
- 20,000+ delivery events
- 10,000 invoices
- 1,000 compliance records

Data should contain realistic relationships and controlled anomalies.

---

### FR-1.3 API

FastAPI must expose REST endpoints for:

```text
GET /loads
GET /loads/{id}

GET /carriers
GET /carriers/{id}

GET /drivers
GET /drivers/{id}

GET /analytics/summary
GET /analytics/carriers
GET /analytics/drivers

GET /predictions/{load_id}
```

---

# F2. Operations Dashboard

Dashboard must display:

### Executive KPIs

- Total loads
- Delivered loads
- Delayed loads
- Revenue
- Average revenue/load
- On-time delivery %
- Active carriers
- Active drivers

### Carrier KPIs

- Total loads
- Revenue
- On-time %
- Late %
- Cancellation %
- Average delivery time

### Load Analytics

- Loads by status
- Loads by route
- Loads by day
- Delayed-load trends

---

# F3. AI Data Assistant

## Input

Natural-language question.

Example:

> "Which carriers generated the most revenue in August?"

## Processing

```text
User question
      ↓
Intent detection
      ↓
Generate SQL
      ↓
Validate SQL
      ↓
Execute read-only query
      ↓
Return structured result
      ↓
LLM generates explanation
```

## Requirements

The assistant must:

- only execute read-only queries
- reject destructive SQL
- restrict access to approved tables
- prevent SQL injection
- show relevant data
- explain results clearly

### Example

User:

> Which carrier had the worst on-time performance?

Assistant:

> Carrier ABC had the lowest on-time delivery rate at 71.4%, based on 312 completed loads.

---

# F4. RAG Knowledge Assistant

## Supported documents

Initially:

- PDF
- TXT
- Markdown

## Processing

```text
Upload
 ↓
Extract text
 ↓
Clean
 ↓
Chunk
 ↓
Generate embeddings
 ↓
Store vectors
 ↓
Retrieve relevant chunks
 ↓
LLM
 ↓
Answer + sources
```

## Requirements

The system must:

1. Store document metadata.
2. Create searchable chunks.
3. Retrieve relevant chunks.
4. Generate answers only from retrieved information.
5. Display document/source references.
6. State when sufficient information cannot be found.

### Critical behavior

If the knowledge base does not contain the answer:

> "I couldn't find this information in the available documents."

The system should **not fabricate an SOP**.

---

# F5. AI Agent

The agent will have controlled tools.

### Tool 1

```text
get_load(load_id)
```

### Tool 2

```text
search_loads(filters)
```

### Tool 3

```text
get_carrier_performance(carrier_id)
```

### Tool 4

```text
get_driver_performance(driver_id)
```

### Tool 5

```text
query_analytics(question)
```

### Tool 6

```text
search_knowledge_base(question)
```

### Tool 7

```text
generate_report(parameters)
```

### Tool execution policy

The agent can:

**Read → Analyze → Recommend → Generate**

The agent cannot:

**Delete → Modify critical records → Dispatch → Financially commit**

without human approval.

---

# F6. Late Delivery Prediction

## Target

Binary classification:

```text
0 = On Time
1 = Likely Late
```

## Candidate features

- route distance
- carrier historical performance
- driver experience
- pickup delay
- load type
- origin
- destination
- day of week
- historical delivery duration
- previous carrier delays

## Models

Start with:

1. Logistic Regression
2. Random Forest
3. XGBoost

Select the best model based on validation performance.

Do **not** optimize solely for accuracy because late deliveries may be imbalanced.

Track:

- Precision
- Recall
- F1
- ROC-AUC
- PR-AUC

---

## Prediction Output

```text
Load: L10092

Late Probability: 82%

Risk: HIGH

Important factors:
1. Pickup delay
2. Carrier historical late rate
3. Route distance
```

SHAP should provide model explanations.

---

# F7. n8n Automation

## Workflow A — Delayed Load Alert

```text
Schedule Trigger
      ↓
Query PostgreSQL
      ↓
Find delayed/high-risk loads
      ↓
AI summary
      ↓
Create alert
      ↓
Send notification
```

---

## Workflow B — Daily Operations Report

```text
Cron
 ↓
Query KPI data
 ↓
Calculate metrics
 ↓
LLM summary
 ↓
Generate report
 ↓
Email/report destination
```

Report:

```text
Daily Logistics Report

Loads: 428
Delivered: 391
Delayed: 37

Revenue: $842,500

On-time delivery: 91.4%

Top concern:
Carrier ABC experienced a 14% increase in late deliveries.
```

---

## Workflow C — High-Risk Carrier Alert

```text
Schedule
 ↓
Calculate carrier metrics
 ↓
Detect threshold breach
 ↓
Generate AI explanation
 ↓
Create manager alert
```

---

# F8. React Web Application

## Pages

### Login

Basic authentication.

### Dashboard

Operational KPI overview.

### AI Copilot

Chat interface.

### Knowledge Base

- Upload documents
- View documents
- Search knowledge

### Predictions

View:

- high-risk loads
- probability
- explanations

### Alerts

View:

- delayed loads
- carrier risks
- automation-generated alerts

---

# F9. Security Requirements

Minimum security requirements:

- Password hashing
- Authentication
- JWT/session protection
- Environment variables for secrets
- No API keys committed to Git
- Read-only database user for AI SQL
- SQL query validation
- Input validation
- File-type validation
- File-size limits
- API rate limiting
- Basic audit logging

The AI assistant must never receive unrestricted database credentials.

---

# 7. Data Model Sketch

## User

```text
User
-----
id
name
email
password_hash
role
created_at
```

---

## Carrier

```text
Carrier
-------
id
name
mc_number
location
rating
status
created_at
```

---

## Driver

```text
Driver
------
id
carrier_id
name
experience_years
safety_score
status
```

---

## Truck

```text
Truck
-----
id
carrier_id
truck_number
truck_type
model_year
status
```

---

## Load

```text
Load
----
id
customer_id
carrier_id
driver_id
truck_id
origin
destination
pickup_datetime
delivery_datetime
actual_delivery_datetime
distance
load_type
revenue
status
created_at
```

---

## Delivery Event

```text
DeliveryEvent
-------------
id
load_id
event_type
event_timestamp
location
description
```

---

## Invoice

```text
Invoice
-------
id
load_id
invoice_number
amount
status
invoice_date
paid_date
```

---

## Compliance Record

```text
ComplianceRecord
----------------
id
carrier_id
driver_id
record_type
status
expiry_date
notes
```

---

## Document

```text
Document
--------
id
name
file_type
storage_path
uploaded_by
created_at
```

---

## Knowledge Chunk

```text
KnowledgeChunk
--------------
id
document_id
chunk_text
embedding
metadata
created_at
```

---

## Prediction

```text
Prediction
----------
id
load_id
model_version
late_probability
risk_level
prediction_date
explanation
```

---

## Alert

```text
Alert
-----
id
type
severity
load_id
carrier_id
message
status
created_at
resolved_at
```

---

# 8. Edge Cases and Failure States

## AI / LLM

### E1 — LLM unavailable

System should display:

> AI service temporarily unavailable. Please try again.

Core dashboards must continue working without the LLM.

---

### E2 — Hallucination risk

RAG responses must be grounded in retrieved documents.

If evidence is insufficient:

> Information not found in the knowledge base.

---

### E3 — Ambiguous question

User:

> "Show me bad carriers."

System should ask:

> Do you mean carriers with low on-time delivery, high cancellation rate, or low overall performance?

---

### E4 — Dangerous SQL

Generated query attempts:

```sql
DELETE FROM loads;
```

System must reject it.

---

### E5 — Invalid SQL

The system should:

1. detect failure
2. log the error
3. optionally regenerate once
4. return a safe failure if unsuccessful

---

## Data

### E6 — Missing carrier

A load references a carrier that doesn't exist.

System should flag the data integrity issue rather than silently inventing a carrier.

---

### E7 — Missing delivery timestamp

The system should exclude incomplete records from on-time calculations and clearly indicate the exclusion.

---

### E8 — Duplicate records

Data ingestion should detect duplicate IDs and prevent duplicate insertion.

---

## ML

### E9 — Model unavailable

Dashboard should display historical operational information while marking prediction unavailable.

---

### E10 — Model confidence is low

The system should display:

> Prediction confidence is low.

It should not present the result as certainty.

---

## Automation

### E11 — n8n workflow failure

Failed workflows should be logged.

The system should avoid generating duplicate alerts after retries.

---

### E12 — Duplicate notification

Each alert should have a unique event/reference ID.

---

## Security

### E13 — Unauthorized user

User receives:

```text
403 Forbidden
```

for resources outside their permissions.

---

### E14 — Malicious document

Uploaded files must be validated and restricted by type and size.

---

# 9. Success Metrics

The project should measure both **product performance** and **AI quality**.

## Product Metrics

### Dashboard

**Target:**

> Dashboard API response < 2 seconds for normal queries.

---

### AI SQL Assistant

Track:

- successful query rate
- SQL execution failure rate
- average response time
- user correction rate

Initial target:

> ≥90% successful responses for predefined benchmark questions.

---

### RAG

Measure:

- retrieval relevance
- grounded answer rate
- citation/source accuracy
- unanswered-question rate

Target:

> ≥90% of benchmark questions should retrieve the correct source material.

---

### AI Agent

Track:

- task completion rate
- tool selection accuracy
- failed tool calls
- average steps per task

Target:

> ≥85% successful completion for predefined agent tasks.

---

### ML

Target metrics should be established using validation data rather than arbitrarily claiming production accuracy.

Minimum evaluation:

- Precision
- Recall
- F1
- ROC-AUC
- PR-AUC
- confusion matrix

Particular emphasis should be placed on **recall for late shipments**, because missing a genuinely high-risk shipment is operationally costly.

---

### Automation

Measure:

- successful workflow execution rate
- duplicate alert rate
- workflow failure rate
- average processing time

Target:

> ≥95% successful automation executions.

---

## Business/Product Metrics

The portfolio simulation should demonstrate:

- reduction in manual reporting time
- reduction in time to identify high-risk loads
- reduction in time spent searching SOPs
- improvement in operational visibility
- percentage of repetitive tasks automated

For example, the project can conduct a controlled benchmark:

**Manual workflow vs AI-assisted workflow**

and report:

```text
Task                         Manual    Copilot
------------------------------------------------
Find delayed loads           5 min     20 sec
Find SOP information         3 min     15 sec
Generate KPI summary         15 min    30 sec
Identify high-risk loads     10 min    20 sec
```

These should be measured during your project testing rather than presented as fabricated business outcomes.

---

# 10. Open Questions

These should remain explicitly unresolved until the product is built or additional business requirements are available.

### OQ1 — LLM provider

The MVP must use free tooling, but API-based LLM usage can incur costs.

Decision required:

- local open-source model
- limited free API tier
- hybrid approach

**Recommended:** design an abstraction layer so the LLM provider can be changed without rewriting the application.

---

### OQ2 — Vector database

Possible options:

- PostgreSQL + pgvector
- Chroma
- FAISS

**Recommended:** PostgreSQL + pgvector to reduce infrastructure complexity.

---

### OQ3 — Deployment

A genuinely production-style deployment requires a hosting strategy.

Free-tier availability can change.

**Recommended architecture:** Dockerized services with deployment configuration separated from application code.

---

### OQ4 — Real-time data

MVP can use scheduled/synthetic data.

Future version should determine whether the system receives:

- TMS events
- ELD events
- GPS data
- carrier updates
- driver updates

---

### OQ5 — Human approval

Which AI actions require explicit approval?

Recommended policy:

**Analysis:** automatic  
**Recommendations:** automatic  
**Alerts:** automatic  
**Database modifications:** approval required  
**External communication:** approval required  
**Financial actions:** approval required

---

### OQ6 — Role-based access

The MVP can implement basic roles:

```text
Admin
Dispatcher
Operations Manager
Viewer
```

Detailed permissions can be expanded in V2.

---

# MVP Definition of Done

The MVP is considered complete only when a user can:

1. Log into the application.
2. View logistics KPIs.
3. Search and inspect loads.
4. Ask an AI question about operational data.
5. Receive a database-backed answer.
6. Upload/search logistics SOP documents.
7. Ask the RAG assistant a question.
8. Receive a grounded answer with sources.
9. Ask the AI agent to perform a multi-step analysis.
10. View late-delivery predictions.
11. See SHAP-based prediction explanations.
12. Receive automated delayed-load alerts.
13. Receive an automated daily operations report.
14. View Power BI analytics.
15. Access documented REST APIs.
16. Run the complete application using Docker.
17. Run automated tests.
18. Deploy the application.
19. Review application logs.
20. Find architecture and setup documentation in GitHub.

---

# Recommended Technical Architecture

```text
                         ┌─────────────────┐
                         │    React Web    │
                         │    Application  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │     FastAPI     │
                         │    REST API     │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌────────────┐      ┌────────────┐      ┌────────────┐
       │ AI Copilot │      │ AI Agent   │      │ ML Service │
       └─────┬──────┘      └─────┬──────┘      └─────┬──────┘
             │                   │                    │
             ▼                   ▼                    ▼
           LLM             Agent Tools            XGBoost
             │                   │                 + SHAP
             ▼                   │
       ┌────────────┐            │
       │    RAG     │            │
       │  Pipeline  │            │
       └─────┬──────┘            │
             │                   │
             └─────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │   PostgreSQL +   │
              │     pgvector     │
              └────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       ┌────────────┐      ┌────────────┐
       │    n8n     │      │  Power BI  │
       │ Automation │      │ Analytics  │
       └────────────┘      └────────────┘
```

## Final Product Positioning

This should **not** be presented as:

> "I made a logistics chatbot."

Present it as:

> **An AI-powered logistics operations platform combining LLM-based natural-language analytics, RAG knowledge retrieval, tool-using AI agents, machine-learning risk prediction, workflow automation and operational BI dashboards.**

That positioning maps extremely well to the target company's requirements because the project demonstrates the complete workflow they are asking a fresher AI Engineer to learn:

**AI/GenAI → LLMs → Prompt Engineering → Agents → APIs → Automation → Python/ML → SQL → Power BI → Business Operations → Production Engineering.**