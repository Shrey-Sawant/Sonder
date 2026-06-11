from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, Integer, Boolean
from datetime import datetime
from db.base import Base

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    sentiment_score = Column(Float, nullable=False)
    sentiment_label = Column(String(50), nullable=False)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
