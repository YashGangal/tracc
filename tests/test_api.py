import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.main import app
from app.core.config import settings
from app.db.models import AuditLog
from app.db.session import SessionLocal, init_db
from app.services.text_to_sql import validate_sql
from app.ml.predictor import predict_for_load

init_db()
client = TestClient(app)


@pytest.fixture
def dispatcher_headers():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alex.dispatcher@logistics.copilot", "password": "dispatcher123"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def manager_headers():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.manager@logistics.copilot", "password": "manager123"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# --- 1. Authentication Tests ---

def test_login_success():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alex.dispatcher@logistics.copilot", "password": "dispatcher123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "dispatcher"
    assert data["user_name"] == "Alex Rivera"

    db = SessionLocal()
    try:
        audit_event = db.query(AuditLog).filter(AuditLog.action == "auth.login").first()
        assert audit_event is not None
        assert audit_event.actor_user_id is not None
    finally:
        db.close()


def test_login_failure():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alex.dispatcher@logistics.copilot", "password": "wrong_password"}
    )
    assert response.status_code == 401


# --- 2. Operational Data Platform APIs ---

def test_operational_routes_require_authentication():
    response = client.get("/api/v1/loads?limit=10")
    assert response.status_code == 401


def test_get_loads(dispatcher_headers):
    response = client.get("/api/v1/loads?limit=10", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    assert "load_number" in data[0]
    assert "status" in data[0]


def test_get_load_detail(dispatcher_headers):
    response = client.get("/api/v1/loads/1", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "origin_city" in data
    assert "destination_city" in data


def test_get_carriers(dispatcher_headers):
    response = client.get("/api/v1/carriers?limit=5", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    assert "mc_number" in data[0]


def test_carrier_performance(dispatcher_headers):
    response = client.get("/api/v1/carriers/1/performance", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert "on_time_rate" in data
    assert "total_loads" in data
    assert 0 <= data["on_time_rate"] <= 100


# --- 3. Executive Analytics APIs ---

def test_get_analytics_kpis(dispatcher_headers):
    response = client.get("/api/v1/analytics/kpis", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_loads"] >= 1000
    assert 0.0 <= data["on_time_delivery_rate"] <= 100.0
    assert data["total_revenue"] > 0


# --- 4. Machine Learning & SHAP Predictions ---

def test_ml_late_delivery_prediction(dispatcher_headers):
    response = client.get("/api/v1/predictions/load/1", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert "late_probability" in data
    assert 0.0 <= data["late_probability"] <= 1.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert len(data["top_contributing_factors"]) > 0
    assert "impact_description" in data["top_contributing_factors"][0]
    assert data["model_version"] == "random-forest-v1.0"


# --- 5. Text-to-SQL Guardrails & AST Validation ---

def test_sql_guardrail_allows_safe_select():
    safe_query = "SELECT load_number, status, revenue FROM loads WHERE status = 'delayed' LIMIT 20;"
    is_valid, err = validate_sql(safe_query)
    assert is_valid is True
    assert err is None


def test_sql_guardrail_blocks_drop_table():
    malicious = "DROP TABLE loads;"
    is_valid, err = validate_sql(malicious)
    assert is_valid is False
    assert "Forbidden keyword" in err or "SELECT" in err


def test_sql_guardrail_blocks_user_table_access():
    malicious = "SELECT email, password_hash FROM users;"
    is_valid, err = validate_sql(malicious)
    assert is_valid is False
    assert "users" in err


def test_sql_guardrail_blocks_excessive_result_limit():
    is_valid, err = validate_sql("SELECT load_number FROM loads LIMIT 51;")
    assert is_valid is False
    assert "LIMIT" in err


# --- 6. RAG Knowledge Assistant & Citations ---

def test_rag_knowledge_query(dispatcher_headers):
    response = client.post(
        "/api/v1/rag/query",
        json={"query": "What is the procedure when a tractor trailer breaks down?"},
        headers=dispatcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["citations"]) > 0
    assert any("SOP-01" in c["document_name"] for c in data["citations"])


def test_dispatcher_cannot_upload_documents(dispatcher_headers):
    response = client.post(
        "/api/v1/rag/upload",
        headers=dispatcher_headers,
        files={"file": ("dispatch-notes.md", b"Operational notes", "text/markdown")},
    )
    assert response.status_code == 403


def test_document_upload_rejects_unsupported_file_types(manager_headers):
    response = client.post(
        "/api/v1/rag/upload",
        headers=manager_headers,
        files={"file": ("payload.exe", b"not a document", "application/octet-stream")},
    )
    assert response.status_code == 400


# --- 7. Autonomous ReAct AI Agent ---

def test_ai_agent_chat_execution(dispatcher_headers):
    response = client.post(
        "/api/v1/agent/chat",
        json={"query": "Find high risk loads and inspect delay probability"},
        headers=dispatcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "final_answer" in data
    assert len(data["action_traces"]) > 0
    assert len(data["tools_used"]) > 0


# --- 8. Alerts & Workflow Automations ---

def test_alerts_list_and_workflow_trigger(manager_headers):
    # Test manual workflow trigger
    trigger_resp = client.post("/api/v1/alerts/trigger/delayed_load", headers=manager_headers)
    assert trigger_resp.status_code == 200
    
    # Test get alerts
    alerts_resp = client.get("/api/v1/alerts", headers=manager_headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) > 0


def test_dispatcher_cannot_trigger_workflows(dispatcher_headers):
    response = client.post("/api/v1/alerts/trigger/workflow_a", headers=dispatcher_headers)
    assert response.status_code == 403


def test_workflow_service_token_can_trigger_daily_report(monkeypatch):
    monkeypatch.setattr(settings, "WORKFLOW_API_TOKEN", "workflow-test-token")
    headers = {"X-Workflow-Token": "workflow-test-token"}

    first = client.post("/api/v1/alerts/trigger/daily_report", headers=headers)
    second = client.post("/api/v1/alerts/trigger/daily_report", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["already_generated"] is True


# --- 9. Backend hardening regressions (B1-B4) ---

def test_carrier_otd_uses_delivered_over_completed(dispatcher_headers):
    resp = client.get("/api/v1/carriers/1/performance", headers=dispatcher_headers)
    assert resp.status_code == 200
    data = resp.json()
    denom = data["delivered_loads"] + data["delayed_loads"]
    expected = round((data["delivered_loads"] / denom * 100), 1) if denom > 0 else 100.0
    assert data["on_time_rate"] == expected


def test_agent_carrier_explicit_id(dispatcher_headers):
    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "Show me carrier 2 performance"},
        headers=dispatcher_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "get_carrier_performance" in data["tools_used"]
    assert "Carrier Performance Inspection" in data["final_answer"]


def test_agent_invalid_carrier_does_not_crash(dispatcher_headers):
    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "Show me carrier 999999 performance"},
        headers=dispatcher_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "not found" in data["final_answer"].lower()


def test_agent_driver_explicit_id(dispatcher_headers):
    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "Show driver 3 safety record"},
        headers=dispatcher_headers,
    )
    assert resp.status_code == 200
    assert "get_driver_performance" in resp.json()["tools_used"]


def test_sql_guardrail_allows_cte_and_alias():
    q = "WITH recent AS (SELECT id FROM loads LIMIT 5) SELECT l.load_number FROM loads l JOIN recent ON recent.id = l.id LIMIT 5;"
    is_valid, err = validate_sql(q)
    assert is_valid is True, err


def test_sql_guardrail_blocks_join_users():
    is_valid, err = validate_sql("SELECT l.load_number FROM loads l JOIN users u ON u.id = l.id LIMIT 5;")
    assert is_valid is False
    assert "users" in err.lower()


def test_sql_guardrail_blocks_multi_statement():
    is_valid, err = validate_sql("SELECT load_number FROM loads LIMIT 5; SELECT carrier FROM carriers LIMIT 5;")
    assert is_valid is False


def test_prediction_persists_to_db(dispatcher_headers):
    resp = client.get("/api/v1/predictions/load/1", headers=dispatcher_headers)
    assert resp.status_code == 200
    from app.db.models import Prediction
    db = SessionLocal()
    try:
        row = db.query(Prediction).filter(Prediction.load_id == 1).order_by(Prediction.id.desc()).first()
        assert row is not None
        assert row.model_version == resp.json()["model_version"]
    finally:
        db.close()


def test_batch_high_risk_limit_validation(dispatcher_headers):
    resp = client.get("/api/v1/predictions/batch/high-risk?limit=100", headers=dispatcher_headers)
    assert resp.status_code == 422
    resp = client.get("/api/v1/predictions/batch/high-risk?limit=5", headers=dispatcher_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 5


def test_workflow_aliases_all_supported(manager_headers):
    for name in ["workflow_a", "workflow_b", "workflow_c"]:
        resp = client.post(f"/api/v1/alerts/trigger/{name}", headers=manager_headers)
        assert resp.status_code == 200, name


def test_alerts_filter_by_type(manager_headers):
    resp = client.get("/api/v1/alerts?status=all&alert_type=daily_ops_report", headers=manager_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_loads_enriched_names(dispatcher_headers):
    resp = client.get("/api/v1/loads?limit=5", headers=dispatcher_headers)
    assert resp.status_code == 200
    for row in resp.json():
        assert "carrier_name" in row
        assert "driver_name" in row


# --- 10. New hardening behavior ---

def test_workflow_token_can_read_kpis_and_copilot(monkeypatch):
    monkeypatch.setattr(settings, "WORKFLOW_API_TOKEN", "workflow-read-token")
    headers = {"X-Workflow-Token": "workflow-read-token"}
    kpis = client.get("/api/v1/analytics/kpis", headers=headers)
    assert kpis.status_code == 200
    assert kpis.json()["total_loads"] >= 1000
    copilot = client.post(
        "/api/v1/copilot/query",
        json={"query": "Show delayed loads"},
        headers=headers,
    )
    assert copilot.status_code == 200
    assert copilot.json()["row_count"] >= 0


def test_workflow_token_rejected_without_token():
    assert client.get("/api/v1/analytics/kpis").status_code == 401
    assert client.get("/api/v1/analytics/kpis", headers={"X-Workflow-Token": "wrong"}).status_code == 401


def test_alert_resolve_idempotent_and_viewer_forbidden(dispatcher_headers):
    trig = client.post("/api/v1/alerts/trigger/delayed_load", headers=dispatcher_headers)
    # dispatcher lacks trigger permission; use manager instead
    assert trig.status_code in (200, 403)
    mgr = client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.manager@logistics.copilot", "password": "manager123"},
    )
    mgr_h = {"Authorization": f"Bearer {mgr.json()['access_token']}"}
    alerts = client.get("/api/v1/alerts?status=active&limit=1", headers=mgr_h).json()
    assert len(alerts) > 0
    aid = alerts[0]["id"]
    first = client.post(f"/api/v1/alerts/{aid}/resolve", headers=mgr_h)
    assert first.status_code == 200
    second = client.post(f"/api/v1/alerts/{aid}/resolve", headers=mgr_h)
    assert second.status_code == 200
    assert second.json().get("already_resolved") is True
    viewer = client.post(
        "/api/v1/auth/login",
        json={"email": "viewer@logistics.copilot", "password": "viewer123"},
    )
    viewer_h = {"Authorization": f"Bearer {viewer.json()['access_token']}"}
    denied = client.post(f"/api/v1/alerts/{aid}/resolve", headers=viewer_h)
    assert denied.status_code == 403


def test_alerts_pagination(manager_headers):
    resp = client.get("/api/v1/alerts?status=all&limit=2&offset=0", headers=manager_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 2
    bad = client.get("/api/v1/alerts?limit=500", headers=manager_headers)
    assert bad.status_code == 422


def test_analytics_limit_validated(dispatcher_headers):
    bad = client.get("/api/v1/analytics/carrier-performance?limit=1000000", headers=dispatcher_headers)
    assert bad.status_code == 422


def test_rag_documents_pagination(dispatcher_headers):
    resp = client.get("/api/v1/rag/documents?limit=2&offset=0", headers=dispatcher_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 2


def test_sql_guardrail_blocks_comma_users_and_multi_limit():
    is_valid, err = validate_sql("SELECT l.load_number FROM loads l, users u LIMIT 5;")
    assert is_valid is False
    assert "users" in err.lower()
    is_valid, err = validate_sql("SELECT load_number FROM loads LIMIT 5 OFFSET 0 LIMIT 5000;")
    assert is_valid is False
    assert "LIMIT" in err


def test_login_rejects_bad_email_and_empty_query(dispatcher_headers):
    bad = client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "x"})
    assert bad.status_code == 422
    empty = client.post("/api/v1/copilot/query", json={"query": ""}, headers=dispatcher_headers)
    assert empty.status_code == 422


# --- 11. Metrix UI support endpoints ---

def test_predictions_benchmark(dispatcher_headers):
    resp = client.get("/api/v1/predictions/benchmark", headers=dispatcher_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "best_model" in data
    assert "benchmark" in data


def test_rag_document_chunks(dispatcher_headers):
    docs = client.get("/api/v1/rag/documents?limit=1", headers=dispatcher_headers).json()
    assert len(docs) > 0
    chunks = client.get(f"/api/v1/rag/documents/{docs[0]['id']}/chunks?limit=3", headers=dispatcher_headers)
    assert chunks.status_code == 200
    assert len(chunks.json()["chunks"]) > 0
    missing = client.get("/api/v1/rag/documents/999999/chunks", headers=dispatcher_headers)
    assert missing.status_code == 404


def test_carrier_performance_has_transit_hours(dispatcher_headers):
    resp = client.get("/api/v1/carriers/1/performance", headers=dispatcher_headers)
    assert resp.status_code == 200
    assert "average_transit_hours" in resp.json()
