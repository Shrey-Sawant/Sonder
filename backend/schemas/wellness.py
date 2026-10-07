from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class ExerciseCompletionCreate(BaseModel):
    exercise_type: str = Field(..., min_length=1, max_length=100, description="Type of exercise (e.g., box_breathing, grounding)")
    duration_seconds: int = Field(..., ge=0, le=86400, description="Duration of the exercise in seconds")

class ExerciseCompletionResponse(BaseModel):
    id: int
    user_id: int
    exercise_type: str
    duration_seconds: int
    completed_at: datetime
    streak: int = 0  # To return streak info

    class Config:
        from_attributes = True

class CheckInCreate(BaseModel):
    q1_score: int = Field(..., ge=0, le=3, description="PHQ-2 Question 1 score (0-3)")
    q2_score: int = Field(..., ge=0, le=3, description="PHQ-2 Question 2 score (0-3)")

class CheckInResponse(BaseModel):
    id: int
    user_id: int
    score: int
    alert_triggered: int
    created_at: datetime
    alert: bool = False
    message: str = ""
    resources: List[str] = []

    class Config:
        from_attributes = True
