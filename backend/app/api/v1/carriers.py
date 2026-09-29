from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.db.models import Carrier, Load
from app.core.business_rules import AVG_TRUCK_MPH
from app.services.stats import carrier_weekly_otd
from app.schemas.logistics import CarrierOut, CarrierPerformance
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/carriers", tags=["Carriers"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[CarrierOut])
def get_carriers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Carrier)
    if status:
        query = query.filter(Carrier.status == status)
    if search:
        query = query.filter(Carrier.name.ilike(f"%{search}%") | Carrier.mc_number.ilike(f"%{search}%"))
    return query.order_by(Carrier.rating.desc()).offset(offset).limit(limit).all()


@router.get("/{id}", response_model=CarrierOut)
def get_carrier(id: int, db: Session = Depends(get_db)):
    carrier = db.query(Carrier).filter(Carrier.id == id).first()
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    return carrier


@router.get("/{id}/performance", response_model=CarrierPerformance)
def get_carrier_performance(id: int, db: Session = Depends(get_db)):
    carrier = db.query(Carrier).filter(Carrier.id == id).first()
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    total_loads = db.query(Load).filter(Load.carrier_id == id).count()
    delayed = db.query(Load).filter(Load.carrier_id == id, Load.status == "delayed").count()
    delivered = db.query(Load).filter(Load.carrier_id == id, Load.status == "delivered").count()
    
    total_rev = db.query(func.sum(Load.revenue)).filter(Load.carrier_id == id).scalar() or 0.0
    avg_rpm = db.query(func.avg(Load.rate_per_mile)).filter(Load.carrier_id == id).scalar() or 0.0
    avg_miles = db.query(func.avg(Load.distance_miles)).filter(Load.carrier_id == id).scalar() or 0.0

    # Consistent OTD: delivered / (delivered + delayed). In-transit/pending excluded.
    denominator = delivered + delayed
    on_time = round(((delivered / denominator) * 100), 1) if denominator > 0 else 100.0

    return CarrierPerformance(
        carrier_id=carrier.id,
        name=carrier.name,
        rating=carrier.rating,
        total_loads=total_loads,
        delivered_loads=delivered,
        delayed_loads=delayed,
        on_time_rate=on_time,
        total_revenue=round(float(total_rev), 2),
        average_rate_per_mile=round(float(avg_rpm), 2),
        # Planning estimate from avg dispatched miles at fleet-average speed.
        average_transit_hours=round(float(avg_miles) / AVG_TRUCK_MPH, 1),
        weekly_on_time=carrier_weekly_otd(db, carrier.id, on_time)
    )
