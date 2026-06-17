import uuid
from sqlalchemy import Column, String, Boolean, Float, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base


class User(Base):
    __tablename__ = "users"

    # Backward compatibility with integer primary key
    id = Column(Integer, index=True)

    # Primary key: UUID instead of Integer
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Anonymous identity system
    anon_id = Column(String, unique=True, index=True, nullable=False)  # e.g., "calmRiver247"
    anon_id_created_at = Column(DateTime, server_default=func.now(), nullable=False)
    anon_mode_enabled = Column(Boolean, default=True)  # Display anon_id instead of real name
    
    # Authentication & Personal
    email = Column(String, unique=True, index=True, nullable=False)
    real_name = Column(Text, nullable=True)  # Will be encrypted at application level
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    # Role & Verification
    role = Column(String, index=True, nullable=False)  # student | counsellor | admin
    verified_counsellor = Column(Boolean, default=False)  # For counsellor verification
    is_verified = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)

    # Counsellor-specific fields
    phone = Column(String, nullable=True)
    experience = Column(Float, nullable=True)  # Years of experience
    certification = Column(String, nullable=True)
    rating = Column(Float, default=0.0)
    is_available = Column(Boolean, default=True)
    
    # Crisis intervention settings
    notify_on_crisis = Column(Boolean, default=True)  # Notify counsellor on crisis detection

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
