from sqlalchemy import Column, Integer, ForeignKey, String, DateTime
from sqlalchemy.sql import func
from db.session import Base


class ScheduleRequest(Base):
    __tablename__ = "schedule_requests"

    id = Column(Integer, primary_key=True)

    student_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    counsellor_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    scheduled_time = Column(DateTime, nullable=False)

    status = Column(String, default="pending")
    # pending | accepted | rejected

    created_at = Column(DateTime, server_default=func.now())
