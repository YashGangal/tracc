from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_name: str
    email: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Customer Schemas
class CustomerOut(BaseModel):
    id: int
    name: str
    code: str
    contact_email: Optional[str] = None
    payment_terms: str

    model_config = ConfigDict(from_attributes=True)


# Carrier Schemas
class CarrierOut(BaseModel):
    id: int
    name: str
    mc_number: str
    dot_number: str
    location: Optional[str] = None
    rating: float
    status: str
    fleet_size: int

    model_config = ConfigDict(from_attributes=True)


class CarrierPerformance(BaseModel):
    carrier_id: int
    name: str
    rating: float
    total_loads: int
    delivered_loads: int
    delayed_loads: int
    on_time_rate: float
    total_revenue: float
    average_rate_per_mile: float
    average_transit_hours: float = 0.0


# Driver Schemas
class DriverOut(BaseModel):
    id: int
    carrier_id: int
    name: str
    license_number: str
    experience_years: int
    safety_score: float
    status: str

    model_config = ConfigDict(from_attributes=True)


# Delivery Event Schema
class DeliveryEventOut(BaseModel):
    id: int
    event_type: str
    event_timestamp: datetime
    location: Optional[str] = None
    description: Optional[str] = None
    delay_minutes: int

    model_config = ConfigDict(from_attributes=True)


# Load Schemas
class LoadOut(BaseModel):
    id: int
    load_number: str
    customer_id: int
    carrier_id: Optional[int] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    pickup_datetime: datetime
    actual_pickup_datetime: Optional[datetime] = None
    delivery_datetime: datetime
    actual_delivery_datetime: Optional[datetime] = None
    distance_miles: float
    load_type: str
    revenue: float
    rate_per_mile: float
    status: str
    carrier_name: Optional[str] = None
    driver_name: Optional[str] = None
    delivery_events: Optional[List[DeliveryEventOut]] = None

    model_config = ConfigDict(from_attributes=True)


class LoadFilter(BaseModel):
    status: Optional[str] = None
    carrier_id: Optional[int] = None
    origin_state: Optional[str] = None
    destination_state: Optional[str] = None
    min_distance: Optional[float] = None
    max_distance: Optional[float] = None
    search: Optional[str] = None
    limit: int = 50
    offset: int = 0


# KPI & Analytics Schemas
class SummaryKPIs(BaseModel):
    total_loads: int
    delivered_loads: int
    delayed_loads: int
    in_transit_loads: int
    pending_loads: int
    on_time_delivery_rate: float
    total_revenue: float
    average_revenue_per_load: float
    active_carriers: int
    active_drivers: int


class LaneAnalytics(BaseModel):
    origin_state: str
    destination_state: str
    total_loads: int
    avg_distance: float
    avg_revenue: float
    delayed_rate: float


# ML Prediction & SHAP Schemas
class SHAPFactor(BaseModel):
    factor_name: str
    importance_value: float
    impact_description: str
    direction: str  # increases_risk, decreases_risk


class PredictionOut(BaseModel):
    load_id: int
    load_number: str
    late_probability: float
    risk_level: str  # LOW, MEDIUM, HIGH
    confidence_score: float
    top_contributing_factors: List[SHAPFactor]
    model_version: str


# Alert Schemas
class AlertOut(BaseModel):
    id: int
    alert_type: str
    severity: str
    load_id: Optional[int] = None
    carrier_id: Optional[int] = None
    title: str
    message: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Copilot & RAG Schemas
class CopilotQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    mode: str = "text_to_sql"  # text_to_sql, rag, agent


class SQLQueryResult(BaseModel):
    generated_sql: str
    explanation: str
    columns: List[str]
    rows: List[List[Any]]
    execution_time_ms: float
    row_count: int


class RAGCitation(BaseModel):
    document_name: str
    section: Optional[str] = None
    relevance_score: float
    snippet: str


class RAGQueryResult(BaseModel):
    query: str
    answer: str
    citations: List[RAGCitation]


class AgentActionTrace(BaseModel):
    step: int
    thought: str
    action: str
    action_input: Dict[str, Any]
    observation: str


class AgentChatResponse(BaseModel):
    query: str
    final_answer: str
    action_traces: List[AgentActionTrace]
    tools_used: List[str]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    intent: str
    mode_used: str  # chitchat | sql | rag | agent
    session_id: str
    action_traces: List[AgentActionTrace] = []
    citations: List[RAGCitation] = []
    generated_sql: Optional[str] = None
    row_count: Optional[int] = None
    columns: List[str] = []
    rows: List[List[Any]] = []
