from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# 1. Base schema for shared fields
class ScheduleRequestBase(BaseModel):
    scheduled_time: datetime
    status: str = "pending"

# 2. What the React Frontend sends
# Notice: student_id is REMOVED because we get it from the Auth Token in the backend
class ScheduleRequestCreate(BaseModel):
    counsellor_id: int
    scheduled_time: datetime

# 3. What the API returns to the Frontend
class ScheduleRequestResponse(ScheduleRequestBase):
    id: int
    student_id: int
    counsellor_id: int
    created_at: datetime

    class Config:
        from_attributes = True