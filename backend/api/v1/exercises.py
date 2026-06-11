from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timedelta, timezone, date
from db.session import get_db
from models.exercise import ExerciseCompletion
from schemas.wellness import ExerciseCompletionCreate, ExerciseCompletionResponse
from api.v1.auth import get_current_user
from models.user import User

router = APIRouter()


async def get_streak(db: AsyncSession, user_id: int) -> int:
    stmt = (
        select(ExerciseCompletion.completed_at)
        .where(ExerciseCompletion.user_id == user_id)
        .order_by(desc(ExerciseCompletion.completed_at))
    )
    res = await db.execute(stmt)
    completions = res.scalars().all()
    if not completions:
        return 0
        
    unique_dates = sorted(list(set(c.date() for c in completions)), reverse=True)
    
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    if unique_dates[0] not in (today, yesterday):
        return 0
        
    streak = 0
    current_check_date = unique_dates[0]
    
    for d in unique_dates:
        if d == current_check_date:
            streak += 1
            current_check_date = current_check_date - timedelta(days=1)
        else:
            break
            
    return streak


@router.get("/history", response_model=list[ExerciseCompletionResponse])
async def get_exercise_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(ExerciseCompletion)
        .where(ExerciseCompletion.user_id == current_user.id)
        .order_by(desc(ExerciseCompletion.completed_at))
    )
    res = await db.execute(stmt)
    completions = res.scalars().all()
    streak = await get_streak(db, current_user.id)
    
    items = []
    for c in completions:
        resp = ExerciseCompletionResponse.model_validate(c)
        resp.streak = streak
        items.append(resp)
    return items


@router.get("/streak")
async def get_current_streak(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    streak = await get_streak(db, current_user.id)
    return {"streak": streak}


@router.post("/complete", response_model=ExerciseCompletionResponse)
async def complete_exercise(
    exercise: ExerciseCompletionCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    new_completion = ExerciseCompletion(
        user_id=current_user.id,
        exercise_type=exercise.exercise_type,
        duration_seconds=exercise.duration_seconds
    )
    db.add(new_completion)
    await db.commit()
    await db.refresh(new_completion)
    
    streak = await get_streak(db, current_user.id)
    
    response = ExerciseCompletionResponse.model_validate(new_completion)
    response.streak = streak
    
    return response
