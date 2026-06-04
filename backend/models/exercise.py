from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from datetime import datetime
from db.session import Base

class ExerciseCompletion(Base):
    __tablename__ = "exercise_completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_type = Column(String(50), nullable=False) # e.g., 'box_breathing', 'grounding'
    duration_seconds = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
