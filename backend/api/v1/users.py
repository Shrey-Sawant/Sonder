from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.session import get_db
from schemas.user import UserResponse
from models.user import User
from models.chat_session import ChatSession
from models.checkin import CheckIn
from models.journal import JournalEntry
from models.exercise import ExerciseCompletion
from api.deps import get_current_user
from datetime import datetime, timezone
import math

router = APIRouter()


def get_relative_time(dt: datetime) -> str:
    if not dt:
        return "never"
    if dt.tzinfo is not None:
        now = datetime.now(timezone.utc)
    else:
        now = datetime.utcnow()
    diff = now - dt
    seconds = diff.total_seconds()
    if seconds < 0:
        seconds = 0
    if seconds < 60:
        return "Just now"
    minutes = seconds / 60
    if minutes < 60:
        return f"{math.floor(minutes)}m ago"
    hours = minutes / 60
    if hours < 24:
        return f"{math.floor(hours)} hours ago" if math.floor(hours) > 1 else "1 hour ago"
    days = hours / 24
    if days < 7:
        return f"{math.floor(days)} days ago" if math.floor(days) > 1 else "1 day ago"
    return dt.strftime("%b %d")


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/pending-counsellors", response_model=list[UserResponse])
async def get_pending_counsellors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    stmt = select(User).where(User.role == "counsellor", User.is_approved == False)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/my-students")
async def get_my_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role == "counsellor":
        result = await db.execute(
            select(User)
            .join(ChatSession, ChatSession.student_id == User.id)
            .where(
                ChatSession.counsellor_id == current_user.id,
                ChatSession.chat_type == "counsellor"
            )
            .distinct(User.id)
        )
    else:
        result = await db.execute(select(User).where(User.role == "student"))

    students = result.scalars().all()
    
    student_list = []
    for s in students:
        # Get latest check-in
        ci_res = await db.execute(
            select(CheckIn)
            .where(CheckIn.user_id == s.id)
            .order_by(desc(CheckIn.created_at))
            .limit(1)
        )
        latest_ci = ci_res.scalars().first()
        risk = "Low"
        mood_label = "😐"
        if latest_ci:
            if latest_ci.score >= 3:
                risk = "High"
            elif latest_ci.score >= 1:
                risk = "Medium"
            
            if latest_ci.score >= 4:
                mood_label = "😔"
            elif latest_ci.score >= 2:
                mood_label = "😐"
            else:
                mood_label = "🙂"

        # Get latest journal entry
        j_res = await db.execute(
            select(JournalEntry)
            .where(JournalEntry.user_id == s.id)
            .order_by(desc(JournalEntry.timestamp))
            .limit(1)
        )
        latest_j = j_res.scalars().first()
        if latest_j:
            if not latest_ci or latest_j.timestamp > latest_ci.created_at:
                mood_label = latest_j.sentiment_label

        # Get latest exercise completion
        ex_res = await db.execute(
            select(ExerciseCompletion)
            .where(ExerciseCompletion.user_id == s.id)
            .order_by(desc(ExerciseCompletion.completed_at))
            .limit(1)
        )
        latest_ex = ex_res.scalars().first()
        
        times = []
        if latest_ci:
            times.append(latest_ci.created_at)
        if latest_j:
            times.append(latest_j.timestamp)
        if latest_ex:
            times.append(latest_ex.completed_at)
            
        last_active_dt = max(times) if times else None
        last_active_str = get_relative_time(last_active_dt)
        
        student_list.append({
            "id": s.id,
            "username": s.username,
            "email": s.email,
            "risk": risk,
            "lastActive": last_active_str,
            "moodLabel": mood_label
        })
        
    return student_list


@router.put("/{user_id}/approve", response_model=UserResponse)
async def approve_counsellor(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}/reject")
async def reject_counsellor(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "Application rejected and user removed"}


@router.get("/", response_model=list[UserResponse])
async def read_users(role: str = None, db: AsyncSession = Depends(get_db)):
    if role:
        stmt = select(User).where(User.role == role)
    else:
        stmt = select(User)
    result = await db.execute(stmt)
    return result.scalars().all()
