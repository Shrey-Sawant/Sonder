from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from datetime import datetime
from db.session import Base

class CheckIn(Base):
    __tablename__ = "check_ins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False) # PHQ-2 score total
    q1_score = Column(Integer, nullable=False)
    q2_score = Column(Integer, nullable=False)
    alert_triggered = Column(Integer, default=0) # 0=False, 1=True
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
