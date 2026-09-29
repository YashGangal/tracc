from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.db.models import Load, Carrier, Driver, DeliveryEvent, Shipment
from app.schemas.logistics import LoadOut
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/loads", tags=["Loads"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[LoadOut])
def get_loads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    carrier_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Load)
    if status:
        query = query.filter(Load.status == status)
    if carrier_id:
        query = query.filter(Load.carrier_id == carrier_id)
    if search:
        # Escape LIKE wildcards so users can't inject %/_ patterns.
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_pattern = f"%{escaped}%"
        query = query.filter(
            or_(
                Load.load_number.ilike(search_pattern, escape="\\"),
                Load.origin_city.ilike(search_pattern, escape="\\"),
                Load.destination_city.ilike(search_pattern, escape="\\"),
                Load.origin_state.ilike(search_pattern, escape="\\"),
                Load.destination_state.ilike(search_pattern, escape="\\")
            )
        )
    loads = query.order_by(Load.pickup_datetime.desc(), Load.id.desc()).offset(offset).limit(limit).all()

    # Batch-fetch related names to avoid N+1 queries.
    carrier_ids = {l.carrier_id for l in loads if l.carrier_id}
    driver_ids = {l.driver_id for l in loads if l.driver_id}
    carriers = {c.id: c.name for c in db.query(Carrier).filter(Carrier.id.in_(carrier_ids)).all()} if carrier_ids else {}
    drivers = {d.id: d.name for d in db.query(Driver).filter(Driver.id.in_(driver_ids)).all()} if driver_ids else {}
    # Enrich with carrier and driver names
    result = []
    for l in loads:
        load_dict = {
            "id": l.id,
            "load_number": l.load_number,
            "customer_id": l.customer_id,
            "carrier_id": l.carrier_id,
            "driver_id": l.driver_id,
            "truck_id": l.truck_id,
            "origin_city": l.origin_city,
            "origin_state": l.origin_state,
            "destination_city": l.destination_city,
            "destination_state": l.destination_state,
            "pickup_datetime": l.pickup_datetime,
            "actual_pickup_datetime": l.actual_pickup_datetime,
            "delivery_datetime": l.delivery_datetime,
            "actual_delivery_datetime": l.actual_delivery_datetime,
            "distance_miles": l.distance_miles,
            "load_type": l.load_type,
            "revenue": l.revenue,
            "rate_per_mile": l.rate_per_mile,
            "status": l.status,
            "carrier_name": carriers.get(l.carrier_id, "Unassigned") if l.carrier_id else "Unassigned",
            "driver_name": drivers.get(l.driver_id, "Unassigned") if l.driver_id else "Unassigned"
        }
        result.append(load_dict)
    return result


@router.get("/stats/summary")
def get_loads_summary(db: Session = Depends(get_db)):
    total = db.query(Load).count()
    delivered = db.query(Load).filter(Load.status == "delivered").count()
    delayed = db.query(Load).filter(Load.status == "delayed").count()
    in_transit = db.query(Load).filter(Load.status == "in_transit").count()
    pending = db.query(Load).filter(Load.status == "pending").count()
    cancelled = db.query(Load).filter(Load.status == "cancelled").count()
    return {
        "total": total,
        "delivered": delivered,
        "delayed": delayed,
        "in_transit": in_transit,
        "pending": pending,
        "cancelled": cancelled
    }


@router.get("/{id}", response_model=LoadOut)
def get_load_by_id(id: int, db: Session = Depends(get_db)):
    load = db.query(Load).filter(Load.id == id).first()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    carrier = db.query(Carrier).filter(Carrier.id == load.carrier_id).first() if load.carrier_id else None
    driver = db.query(Driver).filter(Driver.id == load.driver_id).first() if load.driver_id else None
    events = db.query(DeliveryEvent).filter(DeliveryEvent.load_id == load.id).order_by(DeliveryEvent.event_timestamp.asc()).all()

    load_dict = {
        "id": load.id,
        "load_number": load.load_number,
        "customer_id": load.customer_id,
        "carrier_id": load.carrier_id,
        "driver_id": load.driver_id,
        "truck_id": load.truck_id,
        "origin_city": load.origin_city,
        "origin_state": load.origin_state,
        "destination_city": load.destination_city,
        "destination_state": load.destination_state,
        "pickup_datetime": load.pickup_datetime,
        "actual_pickup_datetime": load.actual_pickup_datetime,
        "delivery_datetime": load.delivery_datetime,
        "actual_delivery_datetime": load.actual_delivery_datetime,
        "distance_miles": load.distance_miles,
        "load_type": load.load_type,
        "revenue": load.revenue,
        "rate_per_mile": load.rate_per_mile,
        "status": load.status,
        "carrier_name": carrier.name if carrier else "Unassigned",
        "driver_name": driver.name if driver else "Unassigned",
        "delivery_events": events
    }
    return load_dict
