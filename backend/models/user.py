
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from sqlalchemy.sql import func
from db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    role = Column(String, index=True, nullable=False)  # student | counsellor | admin

    phone = Column(String, nullable=True)
    experience = Column(Integer, nullable=True)
    certification = Column(String, nullable=True)
    rating = Column(Float, default=0.0)
    is_available = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())
