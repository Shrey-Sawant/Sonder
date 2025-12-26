from pydantic import BaseModel, conint
from datetime import datetime
from typing import Optional


class RatingBase(BaseModel):
    student_id: int
    counsellor_id: int
    rating: conint(ge=1, le=5)  # 1-5
    review: Optional[str] = None


class RatingCreate(RatingBase):
    pass


class RatingResponse(RatingBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
