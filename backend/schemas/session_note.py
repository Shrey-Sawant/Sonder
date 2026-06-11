from pydantic import BaseModel
from datetime import datetime


class SessionNoteBase(BaseModel):
    student_id: int
    text: str


class SessionNoteCreate(SessionNoteBase):
    pass


class SessionNoteResponse(SessionNoteBase):
    id: int
    counsellor_id: int
    created_at: datetime

    class Config:
        from_attributes = True
