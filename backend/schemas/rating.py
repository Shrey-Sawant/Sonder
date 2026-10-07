from pydantic import BaseModel, conint
from datetime import datetime
from typing import Optional


class RatingCreate(BaseModel):
    counsellor_id: int
    rating: conint(ge=1, le=5)  # 1-5
    review: Optional[str] = None


class RatingResponse(BaseModel):
    id: int
    student_id: int
    counsellor_id: int
    rating: int
    review: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
