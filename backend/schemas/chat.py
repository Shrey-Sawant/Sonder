from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatSessionBase(BaseModel):
    student_id: int
    counsellor_id: Optional[int] = None
    chat_type: str  # ai, counsellor
    status: str = "pending"


class ChatSessionCreate(ChatSessionBase):
    pass


class ChatSessionResponse(ChatSessionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageBase(BaseModel):
    session_id: int
    sender_role: str
    message: str


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageResponse(ChatMessageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
