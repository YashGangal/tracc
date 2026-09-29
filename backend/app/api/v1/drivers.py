from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Driver
from app.schemas.logistics import DriverOut
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/drivers", tags=["Drivers"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[DriverOut])
def get_drivers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Driver)
    if status:
        query = query.filter(Driver.status == status)
    if search:
        query = query.filter(Driver.name.ilike(f"%{search}%") | Driver.license_number.ilike(f"%{search}%"))
    return query.order_by(Driver.safety_score.desc()).offset(offset).limit(limit).all()


@router.get("/{id}", response_model=DriverOut)
def get_driver(id: int, db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.id == id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver
