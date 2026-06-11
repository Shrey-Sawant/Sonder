from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.session import get_db
from models.reminder import Reminder
from api.v1.auth import get_current_user
from models.user import User
from pydantic import BaseModel
from typing import Any, Dict

router = APIRouter()

class ReminderCreate(BaseModel):
    type: str
    time_of_day: str
    push_subscription: Dict[str, Any]

@router.post("/")
async def create_reminder(
    reminder: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reminder).where(Reminder.user_id == current_user.id, Reminder.type == reminder.type))
    existing = result.scalars().first()
    
    if existing:
        existing.time_of_day = reminder.time_of_day
        existing.push_subscription = reminder.push_subscription
    else:
        new_reminder = Reminder(
            user_id=current_user.id,
            type=reminder.type,
            time_of_day=reminder.time_of_day,
            push_subscription=reminder.push_subscription
        )
        db.add(new_reminder)
        
    await db.commit()
    return {"message": "Reminder saved"}


@router.get("/current")
async def get_current_reminder(
    type: str = "daily_checkin",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reminder).where(Reminder.user_id == current_user.id, Reminder.type == type))
    reminder = result.scalars().first()
    if not reminder:
        raise HTTPException(status_code=404, detail="No reminder set")
    return reminder
