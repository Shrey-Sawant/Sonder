from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.session import get_db
from models.checkin import CheckIn
from schemas.wellness import CheckInCreate, CheckInResponse
from api.v1.auth import get_current_user
from models.user import User
from datetime import datetime, timedelta, timezone

router = APIRouter()


@router.get("/alerts")
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        select(CheckIn, User.username, User.email)
        .join(User, CheckIn.user_id == User.id)
        .where(CheckIn.alert_triggered == 1, CheckIn.is_resolved == False)
        .order_by(desc(CheckIn.created_at))
    )
    res = await db.execute(stmt)
    alerts = []
    for row in res.all():
        ci, username, email = row
        alerts.append({
            "id": ci.id,
            "studentId": ci.user_id,
            "studentName": username,
            "studentEmail": email,
            "score": ci.score,
            "reason": f"PHQ-2 score is {ci.score}/6 (Interest score: {ci.q1_score}, Depressed score: {ci.q2_score}).",
            "timestamp": ci.created_at.isoformat(),
            "isResolved": ci.is_resolved
        })
    return alerts


@router.put("/alerts/{checkin_id}/resolve")
async def resolve_alert(
    checkin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    res = await db.execute(select(CheckIn).where(CheckIn.id == checkin_id))
    ci = res.scalars().first()
    if not ci:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    ci.is_resolved = True
    await db.commit()
    return {"message": "Alert marked as resolved"}


@router.get("/history")
async def get_checkin_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(CheckIn)
        .where(CheckIn.user_id == current_user.id)
        .order_by(desc(CheckIn.created_at))
        .limit(30)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/", response_model=CheckInResponse)
async def create_checkin(
    checkin: CheckInCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(CheckIn).where(CheckIn.user_id == current_user.id).where(CheckIn.created_at >= today_start)
    )
    todays_checkins = result.scalars().all()
    if len(todays_checkins) >= 3:
        raise HTTPException(status_code=429, detail="Maximum 3 check-ins per day allowed.")

    total_score = checkin.q1_score + checkin.q2_score
    alert_triggered = 1 if total_score >= 3 else 0

    new_checkin = CheckIn(
        user_id=current_user.id,
        score=total_score,
        q1_score=checkin.q1_score,
        q2_score=checkin.q2_score,
        alert_triggered=alert_triggered
    )
    
    db.add(new_checkin)
    await db.commit()
    await db.refresh(new_checkin)
    
    response = CheckInResponse.model_validate(new_checkin)
    
    if alert_triggered:
        response.alert = True
        response.message = "It sounds like things are really tough right now. You don't have to carry this alone."
        response.resources = [
            "National Suicide Prevention Lifeline: 988",
            "Crisis Text Line: Text HOME to 741741",
            "The Trevor Project (LGBTQ Youth): 1-866-488-7386"
        ]
        
    return response
