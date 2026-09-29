from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.db.session import get_db
from app.db.models import Load, Carrier, Driver, User
from app.schemas.logistics import SummaryKPIs
from app.api.v1.auth import get_current_user, get_current_user_or_workflow_token

router = APIRouter(prefix="/analytics", tags=["Analytics"])


ANALYTICS_LIMIT_MAX = 200


@router.get("/kpis", response_model=SummaryKPIs)
def get_summary_kpis(
    db: Session = Depends(get_db),
    _: Optional[User] = Depends(get_current_user_or_workflow_token),
):
    total_loads = db.query(Load).count()
    delivered = db.query(Load).filter(Load.status == "delivered").count()
    delayed = db.query(Load).filter(Load.status == "delayed").count()
    in_transit = db.query(Load).filter(Load.status == "in_transit").count()
    pending = db.query(Load).filter(Load.status == "pending").count()

    total_rev = db.query(func.sum(Load.revenue)).scalar() or 0.0
    avg_rev = (total_rev / total_loads) if total_loads > 0 else 0.0
    
    denominator = delivered + delayed
    on_time = round((delivered / denominator * 100), 1) if denominator > 0 else 100.0

    active_carriers = db.query(Carrier).filter(Carrier.status == "active").count()
    active_drivers = db.query(Driver).filter(Driver.status.in_(["available", "on_duty"])).count()

    return SummaryKPIs(
        total_loads=total_loads,
        delivered_loads=delivered,
        delayed_loads=delayed,
        in_transit_loads=in_transit,
        pending_loads=pending,
        on_time_delivery_rate=on_time,
        total_revenue=round(float(total_rev), 2),
        average_revenue_per_load=round(float(avg_rev), 2),
        active_carriers=active_carriers,
        active_drivers=active_drivers
    )


@router.get("/carrier-performance")
def get_top_carrier_performance(
    limit: int = Query(10, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    results = db.query(
        Carrier.id,
        Carrier.name,
        Carrier.rating,
        Carrier.fleet_size,
        func.count(Load.id).label("total_loads"),
        func.sum(case((Load.status == "delivered", 1), else_=0)).label("delivered_loads"),
        func.sum(case((Load.status == "delayed", 1), else_=0)).label("delayed_loads"),
        func.sum(Load.revenue).label("total_revenue"),
        func.avg(Load.distance_miles).label("avg_miles")
    ).join(Load, Carrier.id == Load.carrier_id, isouter=True)\
     .group_by(Carrier.id, Carrier.name, Carrier.rating, Carrier.fleet_size)\
     .order_by(func.count(Load.id).desc())\
     .limit(limit).all()

    formatted = []
    for row in results:
        delivered = row.delivered_loads or 0
        delayed = row.delayed_loads or 0
        # Consistent OTD: delivered / (delivered + delayed).
        denominator = delivered + delayed
        on_time = round((delivered / denominator * 100), 1) if denominator > 0 else 100.0
        formatted.append({
            "carrier_id": row.id,
            "carrier_name": row.name,
            "rating": row.rating,
            "fleet_size": row.fleet_size,
            "total_loads": row.total_loads,
            "delivered_loads": delivered,
            "delayed_loads": delayed,
            "on_time_rate": on_time,
            "total_revenue": round(float(row.total_revenue or 0.0), 2),
            # Planning estimate from avg dispatched miles at 48 mph fleet average.
            "average_transit_hours": round(float(row.avg_miles or 0.0) / 48.0, 1)
        })
    return formatted


@router.get("/revenue-trends")
def get_revenue_trends(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Group by date for charts
    loads = db.query(
        func.date(Load.pickup_datetime).label("pickup_date"),
        func.count(Load.id).label("load_count"),
        func.sum(Load.revenue).label("daily_revenue"),
        func.sum(case((Load.status == "delayed", 1), else_=0)).label("delayed_count")
    ).group_by(func.date(Load.pickup_datetime))\
     .order_by(func.date(Load.pickup_datetime).desc())\
     .limit(14).all()

    # Return chronological order for charts
    formatted = []
    for r in reversed(loads):
        formatted.append({
            "date": str(r.pickup_date),
            "loads": r.load_count,
            "revenue": round(float(r.daily_revenue or 0.0), 2),
            "delayed": r.delayed_count
        })
    return formatted


@router.get("/lane-trends")
def get_lane_trends(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lanes = db.query(
        Load.origin_state,
        Load.destination_state,
        func.count(Load.id).label("volume"),
        func.avg(Load.distance_miles).label("avg_miles"),
        func.sum(case((Load.status == "delayed", 1), else_=0)).label("delays")
    ).group_by(Load.origin_state, Load.destination_state)\
     .order_by(func.count(Load.id).desc())\
     .limit(8).all()

    results = []
    for lane in lanes:
        delay_rate = round((lane.delays / lane.volume * 100), 1) if lane.volume > 0 else 0.0
        results.append({
            "lane": f"{lane.origin_state} -> {lane.destination_state}",
            "volume": lane.volume,
            "avg_miles": int(round(float(lane.avg_miles), 0)),
            "delay_rate": delay_rate
        })
    return results
