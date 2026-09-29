import json
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="dispatcher", nullable=False)  # admin, dispatcher, operations_manager, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(100), nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    actor = relationship("User")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    contact_email = Column(String(255))
    payment_terms = Column(String(50), default="Net 30")
    created_at = Column(DateTime, default=datetime.utcnow)

    loads = relationship("Load", back_populates="customer")


class Carrier(Base):
    __tablename__ = "carriers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    mc_number = Column(String(50), unique=True, index=True, nullable=False)
    dot_number = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(255))
    rating = Column(Float, default=4.5)
    status = Column(String(50), default="active")  # active, probation, suspended
    fleet_size = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)

    drivers = relationship("Driver", back_populates="carrier")
    trucks = relationship("Truck", back_populates="carrier")
    loads = relationship("Load", back_populates="carrier")
    compliance_records = relationship("ComplianceRecord", back_populates="carrier")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), index=True, nullable=False)
    name = Column(String(255), index=True, nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    experience_years = Column(Integer, default=3)
    safety_score = Column(Float, default=95.0)  # 0 to 100
    status = Column(String(50), default="available")  # available, on_duty, resting, off_duty
    created_at = Column(DateTime, default=datetime.utcnow)

    carrier = relationship("Carrier", back_populates="drivers")
    loads = relationship("Load", back_populates="driver")
    compliance_records = relationship("ComplianceRecord", back_populates="driver")


class Truck(Base):
    __tablename__ = "trucks"

    id = Column(Integer, primary_key=True, index=True)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), index=True, nullable=False)
    truck_number = Column(String(50), nullable=False)
    truck_type = Column(String(50), default="Dry Van")  # Dry Van, Reefer, Flatbed, Step Deck
    model_year = Column(Integer, default=2022)
    status = Column(String(50), default="active")  # active, maintenance, inactive
    created_at = Column(DateTime, default=datetime.utcnow)

    carrier = relationship("Carrier", back_populates="trucks")
    loads = relationship("Load", back_populates="truck")


class Load(Base):
    __tablename__ = "loads"

    id = Column(Integer, primary_key=True, index=True)
    load_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), index=True, nullable=False)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), index=True, nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), index=True, nullable=True)
    truck_id = Column(Integer, ForeignKey("trucks.id"), index=True, nullable=True)
    
    origin_city = Column(String(100), nullable=False)
    origin_state = Column(String(10), nullable=False)
    destination_city = Column(String(100), nullable=False)
    destination_state = Column(String(10), nullable=False)
    
    pickup_datetime = Column(DateTime, nullable=False, index=True)
    actual_pickup_datetime = Column(DateTime, nullable=True)
    delivery_datetime = Column(DateTime, nullable=False, index=True)
    actual_delivery_datetime = Column(DateTime, nullable=True)
    
    distance_miles = Column(Float, nullable=False)
    load_type = Column(String(50), default="Dry Van")
    revenue = Column(Float, default=0.0)
    rate_per_mile = Column(Float, default=0.0)
    status = Column(String(50), default="pending", index=True)  # pending, assigned, in_transit, delivered, delayed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="loads")
    carrier = relationship("Carrier", back_populates="loads")
    driver = relationship("Driver", back_populates="loads")
    truck = relationship("Truck", back_populates="loads")
    shipments = relationship("Shipment", back_populates="load")
    delivery_events = relationship("DeliveryEvent", back_populates="load")
    invoices = relationship("Invoice", back_populates="load")
    predictions = relationship("Prediction", back_populates="load")
    alerts = relationship("Alert", back_populates="load")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    load_id = Column(Integer, ForeignKey("loads.id"), index=True, nullable=False)
    weight_lbs = Column(Float, default=20000.0)
    commodity = Column(String(255), default="General Freight")
    pieces = Column(Integer, default=20)
    special_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    load = relationship("Load", back_populates="shipments")


class DeliveryEvent(Base):
    __tablename__ = "delivery_events"

    id = Column(Integer, primary_key=True, index=True)
    load_id = Column(Integer, ForeignKey("loads.id"), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)  # pickup_arrival, departed_origin, gps_ping, delay_reported, delivery_arrival, delivered
    event_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    location = Column(String(255))
    description = Column(Text)
    delay_minutes = Column(Integer, default=0)

    load = relationship("Load", back_populates="delivery_events")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    load_id = Column(Integer, ForeignKey("loads.id"), index=True, nullable=False)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(50), default="issued")  # issued, paid, overdue, disputed
    invoice_date = Column(DateTime, default=datetime.utcnow)
    paid_date = Column(DateTime, nullable=True)

    load = relationship("Load", back_populates="invoices")


class ComplianceRecord(Base):
    __tablename__ = "compliance_records"

    id = Column(Integer, primary_key=True, index=True)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), index=True, nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), index=True, nullable=True)
    record_type = Column(String(100), nullable=False)  # CDL_Verification, DOT_Inspection, Medical_Card, Insurance_COI
    status = Column(String(50), default="valid")  # valid, expired, pending_review, failed
    expiry_date = Column(DateTime, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    carrier = relationship("Carrier", back_populates="compliance_records")
    driver = relationship("Driver", back_populates="compliance_records")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    file_type = Column(String(50), default="md")
    storage_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    uploaded_by = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON array of floats for cross-db compatibility
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    load_id = Column(Integer, ForeignKey("loads.id"), index=True, nullable=False)
    model_version = Column(String(50), default="unversioned-model")
    late_probability = Column(Float, nullable=False)  # 0.0 to 1.0
    risk_level = Column(String(20), nullable=False)  # LOW, MEDIUM, HIGH
    factor_json = Column(Text, nullable=True)  # JSON list of top SHAP factors
    created_at = Column(DateTime, default=datetime.utcnow)

    load = relationship("Load", back_populates="predictions")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False)  # delayed_load, high_risk_load, carrier_threshold, driver_hos
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    load_id = Column(Integer, ForeignKey("loads.id"), index=True, nullable=True)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), index=True, nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="active")  # active, acknowledged, resolved
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    load = relationship("Load", back_populates="alerts")
