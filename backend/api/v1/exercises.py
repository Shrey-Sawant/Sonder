from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime, timedelta, timezone
from db.session import get_db
from models.exercise import ExerciseCompletion
from schemas.wellness import ExerciseCompletionCreate, ExerciseCompletionResponse
from api.v1.auth import get_current_user
from models.user import User

router = APIRouter()

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
    
    # Calculate streak (simplified: count unique days in the last N days where there's an entry)
    # A true streak calculation would check consecutive days backwards from today.
    # For now, let's just return a generic streak value (e.g. 1) as placeholder.
    # In a full implementation, we'd query the DB for consecutive days.
    streak = 1 
    
    response = ExerciseCompletionResponse.model_validate(new_completion)
    response.streak = streak
    
    return response
