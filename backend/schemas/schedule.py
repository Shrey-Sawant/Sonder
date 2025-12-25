from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ScheduleRequestBase(BaseModel):
    student_id: int
    counsellor_id: int
    scheduled_time: datetime
    status: str = "pending"


class ScheduleRequestCreate(ScheduleRequestBase):
    pass


class ScheduleRequestResponse(ScheduleRequestBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
