import os
import sys
import random
from datetime import datetime, timedelta
from sqlalchemy import text

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.session import engine, init_db, SessionLocal, ACTIVE_DB_URL
from app.db.models import (
    User, Customer, Carrier, Driver, Truck, Load, Shipment, 
    DeliveryEvent, Invoice, ComplianceRecord, Prediction, Alert,
    AuditLog, Document, KnowledgeChunk
)
from app.core.security import get_password_hash

CITIES_STATES = [
    ("Chicago", "IL"), ("Dallas", "TX"), ("Atlanta", "GA"), ("Los Angeles", "CA"),
    ("Columbus", "OH"), ("Indianapolis", "IN"), ("Memphis", "TN"), ("Kansas City", "MO"),
    ("Allentown", "PA"), ("Harrisburg", "PA"), ("Charlotte", "NC"), ("Houston", "TX"),
    ("Denver", "CO"), ("Phoenix", "AZ"), ("Seattle", "WA"), ("Nashville", "TN"),
    ("Louisville", "KY"), ("Ontario", "CA"), ("Jacksonville", "FL"), ("Detroit", "MI")
]

CARRIER_PREFIXES = [
    "Swift", "Apex", "Horizon", "Pioneer", "Crossroads", "Eagle", "Titan", "Summit",
    "Silver Star", "Blue Ridge", "Midwest Express", "Lone Star", "Ironclad", "TransContinental",
    "Pacific Coast", "Great Lakes", "FreightMasters", "Overland", "Vanguard", "Liberty"
]

CARRIER_SUFFIXES = ["Logistics", "Transport", "Freight", "Express", "Hauling", "Lines", "Carriers"]

FIRST_NAMES = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
    "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua",
    "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
]

COMMODITIES = [
    "Automotive Parts", "Packaged Food", "Paper Products", "Electronics", "Pharmaceuticals",
    "Beverages", "Building Materials", "Retail Goods", "Machinery", "Plastics", "Chemicals (Non-hazmat)"
]


def _reset_pg_sequences(db):
    """Advance Postgres serial sequences past bulk-inserted explicit IDs."""
    if not ACTIVE_DB_URL.startswith("postgresql"):
        return
    tables = [
        "users", "customers", "carriers", "drivers", "trucks", "loads",
        "shipments", "delivery_events", "invoices", "compliance_records",
        "predictions", "alerts",
    ]
    for tbl in tables:
        try:
            db.execute(
                text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE(MAX(id), 1)) FROM {tbl}")
            )
        except Exception as exc:
            print(f"Sequence reset skipped for {tbl}: {exc}")
    db.commit()


def generate_seed_data(num_loads=10000, num_carriers=500, num_drivers=2000, num_trucks=1000, force=False):
    init_db()
    db = SessionLocal()

    if force:
        print("Force flag set: clearing operational tables...")
        db.query(KnowledgeChunk).delete()
        db.query(Document).delete()
        db.query(AuditLog).delete()
        db.query(Alert).delete()
        db.query(Prediction).delete()
        db.query(ComplianceRecord).delete()
        db.query(Invoice).delete()
        db.query(DeliveryEvent).delete()
        db.query(Shipment).delete()
        db.query(Load).delete()
        db.query(Truck).delete()
        db.query(Driver).delete()
        db.query(Carrier).delete()
        db.query(Customer).delete()
        db.query(User).delete()
        db.commit()

    existing_loads = db.query(Load).count()
    if existing_loads >= num_loads and not force:
        print(f"Data already detected ({existing_loads} loads). Skipping seed or pass --force.")
        db.close()
        return

    print("Generating seed data...")

    # 1. Users (Seed the core personas)
    users = [
        User(
            email="admin@logistics.copilot",
            password_hash=get_password_hash("admin123"),
            full_name="Operations Admin",
            role="admin"
        ),
        User(
            email="alex.dispatcher@logistics.copilot",
            password_hash=get_password_hash("dispatcher123"),
            full_name="Alex Rivera",
            role="dispatcher"
        ),
        User(
            email="sarah.manager@logistics.copilot",
            password_hash=get_password_hash("manager123"),
            full_name="Sarah Jenkins",
            role="operations_manager"
        ),
        User(
            email="viewer@logistics.copilot",
            password_hash=get_password_hash("viewer123"),
            full_name="Logistics Analyst",
            role="viewer"
        )
    ]
    db.bulk_save_objects(users)
    db.commit()
    print("[OK] Created default user personas (Alex Dispatcher, Sarah Manager, Admin, Viewer).")
    # 2. Customers
    customers_data = [
        ("Acme Retail Corp", "CUST-ACME"),
        ("Global Foods Inc", "CUST-GBLF"),
        ("NorthStar Industrial", "CUST-NSTR"),
        ("Summit Auto Suppliers", "CUST-SMAT"),
        ("Beacon Consumer Goods", "CUST-BCON"),
        ("Precision Tech Logistics", "CUST-PTEC"),
        ("Vanguard Materials", "CUST-VMTR"),
        ("Apex Beverage Dist.", "CUST-APXB")
    ]
    customer_objs = []
    for name, code in customers_data:
        customer_objs.append(Customer(
            name=name,
            code=code,
            contact_email=f"logistics@{code.lower()}.com",
            payment_terms="Net 30"
        ))
    db.bulk_save_objects(customer_objs)
    db.commit()
    customer_ids = [c.id for c in db.query(Customer).all()]
    print(f"[OK] Created {len(customer_ids)} Enterprise Customers.")

    # 3. Carriers (500 carriers with realistic performance distributions)
    print(f"Generating {num_carriers} Carriers...")
    carrier_objs = []
    for i in range(1, num_carriers + 1):
        c_name = f"{random.choice(CARRIER_PREFIXES)} {random.choice(CARRIER_SUFFIXES)} {i}"
        mc = f"MC-{100000 + i}"
        dot = f"DOT-{2000000 + i}"
        city, state = random.choice(CITIES_STATES)
        
        # 10% chronic delayers, 75% solid performers, 15% elite performers
        rand_profile = random.random()
        if rand_profile < 0.10:
            rating = round(random.uniform(2.8, 3.7), 1)
            status = "probation" if random.random() < 0.3 else "active"
        elif rand_profile < 0.85:
            rating = round(random.uniform(4.0, 4.7), 1)
            status = "active"
        else:
            rating = round(random.uniform(4.8, 5.0), 1)
            status = "active"

        carrier_objs.append(Carrier(
            name=c_name,
            mc_number=mc,
            dot_number=dot,
            location=f"{city}, {state}",
            rating=rating,
            status=status,
            fleet_size=random.randint(5, 120)
        ))
    db.bulk_save_objects(carrier_objs)
    db.commit()
    carrier_ids = [c.id for c in db.query(Carrier).all()]

    # 4. Drivers (2000 drivers)
    print(f"Generating {num_drivers} Drivers...")
    driver_objs = []
    for i in range(1, num_drivers + 1):
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        driver_objs.append(Driver(
            carrier_id=random.choice(carrier_ids),
            name=name,
            license_number=f"CDL-{1000000 + i}",
            experience_years=random.randint(1, 25),
            safety_score=round(random.uniform(78.0, 99.5), 1),
            status=random.choice(["available", "on_duty", "resting"])
        ))
    db.bulk_save_objects(driver_objs)
    db.commit()
    driver_ids = [d.id for d in db.query(Driver).all()]

    # 5. Trucks (1000 trucks)
    print(f"Generating {num_trucks} Trucks...")
    truck_objs = []
    truck_types = ["Dry Van", "Reefer", "Flatbed", "Step Deck"]
    for i in range(1, num_trucks + 1):
        truck_objs.append(Truck(
            carrier_id=random.choice(carrier_ids),
            truck_number=f"TRK-{4000 + i}",
            truck_type=random.choices(truck_types, weights=[0.55, 0.25, 0.15, 0.05])[0],
            model_year=random.randint(2018, 2024),
            status="active"
        ))
    db.bulk_save_objects(truck_objs)
    db.commit()
    truck_ids = [t.id for t in db.query(Truck).all()]

    # 6. Loads (10,000 loads spanning the past 90 days up to the next 3 days)
    print(f"Generating {num_loads} Loads with realistic transit correlations...")
    now = datetime.utcnow()
    loads_to_insert = []
    shipments_to_insert = []
    events_to_insert = []
    invoices_to_insert = []

    # Status distribution emerges from the pickup-date logic below:
    # past -> delivered/delayed/cancelled, active window -> delayed/in_transit, future -> pending

    for i in range(1, num_loads + 1):
        load_num = f"L{10000 + i}"
        customer_id = random.choice(customer_ids)
        carrier_id = random.choice(carrier_ids)
        driver_id = random.choice(driver_ids)
        truck_id = random.choice(truck_ids)

        orig_city, orig_state = random.choice(CITIES_STATES)
        dest_city, dest_state = random.choice([c for c in CITIES_STATES if c[0] != orig_city])

        dist = round(random.uniform(180, 2200), 1)
        transit_hours = dist / 48.0  # avg 48 mph truck transit
        rate_pm = round(random.uniform(2.10, 3.85), 2)
        revenue = round(dist * rate_pm, 2)

        # Distribute pickup across past 90 days
        days_ago = random.uniform(-3, 90)
        pickup_time = now - timedelta(days=days_ago)
        sched_delivery = pickup_time + timedelta(hours=transit_hours + random.uniform(4, 12))

        # Status logic
        if days_ago > 2:
            # Past load
            if random.random() < 0.03:
                status = "cancelled"
                actual_pickup = None
                actual_delivery = None
            else:
                # 85% on-time, 15% delayed
                is_delay = random.random() < 0.15
                status = "delayed" if is_delay else "delivered"
                actual_pickup = pickup_time + timedelta(minutes=random.randint(0, 180) if is_delay else random.randint(-15, 20))
                delay_delta = timedelta(hours=random.uniform(2, 14)) if is_delay else timedelta(minutes=random.randint(-30, 15))
                actual_delivery = sched_delivery + delay_delta
        elif days_ago > 0:
            # Currently active load
            status = "delayed" if random.random() < 0.25 else "in_transit"
            actual_pickup = pickup_time + timedelta(minutes=random.randint(0, 90))
            actual_delivery = None
        else:
            # Future load
            status = "pending"
            actual_pickup = None
            actual_delivery = None

        load_item = {
            "id": i,
            "load_number": load_num,
            "customer_id": customer_id,
            "carrier_id": carrier_id,
            "driver_id": driver_id,
            "truck_id": truck_id,
            "origin_city": orig_city,
            "origin_state": orig_state,
            "destination_city": dest_city,
            "destination_state": dest_state,
            "pickup_datetime": pickup_time,
            "actual_pickup_datetime": actual_pickup,
            "delivery_datetime": sched_delivery,
            "actual_delivery_datetime": actual_delivery,
            "distance_miles": dist,
            "load_type": random.choice(["Dry Van", "Dry Van", "Dry Van", "Reefer", "Flatbed", "Step Deck"]),
            "revenue": revenue,
            "rate_per_mile": rate_pm,
            "status": status,
            "created_at": pickup_time - timedelta(days=2)
        }
        loads_to_insert.append(load_item)

        # Accompanying shipment
        shipments_to_insert.append({
            "load_id": i,
            "weight_lbs": round(random.uniform(8000, 44000), 1),
            "commodity": random.choice(COMMODITIES),
            "pieces": random.randint(10, 60),
            "special_instructions": "Maintain temperature at 34F" if load_item["load_type"] == "Reefer" else "Standard pallet securement",
            "created_at": load_item["created_at"]
        })

        # Delivery event
        if status in ["in_transit", "delayed", "delivered"]:
            events_to_insert.append({
                "load_id": i,
                "event_type": "pickup_arrival",
                "event_timestamp": pickup_time,
                "location": f"{orig_city}, {orig_state}",
                "description": "Driver arrived at origin facility.",
                "delay_minutes": 0
            })
            if status == "delayed":
                events_to_insert.append({
                    "load_id": i,
                    "event_type": "delay_reported",
                    "event_timestamp": pickup_time + timedelta(hours=random.uniform(4, 10)),
                    "location": "Interstate Corridor",
                    "description": "Severe highway congestion and heavy weather slowdown.",
                    "delay_minutes": random.randint(90, 360)
                })

        # Invoices (paid status and paid_date use one draw so they stay consistent)
        if status == "delivered":
            is_paid = random.random() < 0.85
            invoices_to_insert.append({
                "load_id": i,
                "invoice_number": f"INV-{50000 + i}",
                "amount": revenue,
                "status": "paid" if is_paid else "issued",
                "invoice_date": sched_delivery,
                "paid_date": sched_delivery + timedelta(days=15) if is_paid else None
            })

    # Bulk insert loads in batches
    print("Writing Loads to database...")
    db.bulk_insert_mappings(Load, loads_to_insert)
    db.commit()

    print("Writing Shipments & Events to database...")
    db.bulk_insert_mappings(Shipment, shipments_to_insert)
    db.bulk_insert_mappings(DeliveryEvent, events_to_insert)
    db.bulk_insert_mappings(Invoice, invoices_to_insert)
    db.commit()

    # 7. Compliance records
    print("Writing Compliance records...")
    compliance_objs = []
    comp_types = ["CDL_Verification", "DOT_Inspection", "Medical_Card", "Insurance_COI"]
    for i in range(1, 1001):
        carrier_id = random.choice(carrier_ids)
        driver_id = random.choice(driver_ids)
        compliance_objs.append(ComplianceRecord(
            carrier_id=carrier_id,
            driver_id=driver_id,
            record_type=random.choice(comp_types),
            status="valid" if random.random() < 0.94 else "expired",
            expiry_date=now + timedelta(days=random.randint(-30, 365)),
            notes="Passed routine regulatory inspection."
        ))
    db.bulk_save_objects(compliance_objs)
    db.commit()

    # 8. Seed sample alerts
    print("Writing Initial Operational Alerts...")
    alerts = [
        Alert(
            alert_type="delayed_load",
            severity="high",
            load_id=loads_to_insert[0]["id"],
            carrier_id=loads_to_insert[0]["carrier_id"],
            title="Load L10001 Exceeding Delay Threshold",
            message="Load L10001 currently delayed by 180 minutes on I-80 due to winter weather conditions.",
            status="active"
        ),
        Alert(
            alert_type="high_risk_carrier",
            severity="medium",
            carrier_id=carrier_ids[5],
            title="Carrier 14-Day Late Rate Breach",
            message=f"Carrier {carrier_objs[5].name} late delivery rate increased to 22.4% over 18 loads.",
            status="active"
        ),
        Alert(
            alert_type="high_risk_load",
            severity="critical",
            load_id=loads_to_insert[1]["id"],
            carrier_id=loads_to_insert[1]["carrier_id"],
            title="Predicted Late Delivery Risk (88%)",
            message="ML delay-risk engine predicts 88% probability of delay due to 110 min pickup delay and high route miles.",
            status="active"
        )
    ]
    db.bulk_save_objects(alerts)
    db.commit()
    _reset_pg_sequences(db)

    print("[OK] Successfully generated 10,000 Loads, 500 Carriers, 2,000 Drivers, 1,000 Trucks, and associated operational records!")
    db.close()


if __name__ == "__main__":
    count = 10000
    force_seed = False
    for arg in sys.argv[1:]:
        if arg == "--force":
            force_seed = True
        elif arg.isdigit():
            count = int(arg)
    generate_seed_data(num_loads=count, force=force_seed)
