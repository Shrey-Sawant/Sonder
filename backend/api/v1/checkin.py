from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.session import get_db
from models.checkin import CheckIn
from schemas.wellness import CheckInCreate, CheckInResponse
from api.v1.auth import get_current_user
from models.user import User
from datetime import datetime, timedelta, timezone

router = APIRouter()

# In a real app we'd use slowapi, but here we do a simple DB check for 3 per day limit.
@router.post("/", response_model=CheckInResponse)
async def create_checkin(
    checkin: CheckInCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Check rate limit (max 3 per day)
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
