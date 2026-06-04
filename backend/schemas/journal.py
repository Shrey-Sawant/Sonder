from pydantic import BaseModel, Field
from datetime import datetime

class JournalEntryCreate(BaseModel):
    text: str = Field(..., description="The content of the journal entry")

class JournalEntryResponse(BaseModel):
    id: int
    user_id: int
    text: str
    sentiment_score: float
    sentiment_label: str
    timestamp: datetime

    class Config:
        from_attributes = True
