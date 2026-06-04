from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON
from datetime import datetime
from db.session import Base

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False) # 'journal', 'exercise', 'checkin'
    time_of_day = Column(String(10), nullable=False) # 'HH:MM'
    push_subscription = Column(JSON, nullable=True) # Web Push Subscription object
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
