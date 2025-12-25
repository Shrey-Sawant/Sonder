from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from db.session import Base


class CounsellorRating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True)

    student_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    counsellor_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    rating = Column(Integer, nullable=False)  # 1 to 5
    review = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "student_id", "counsellor_id", name="unique_student_counsellor_rating"
        ),
    )
