import uuid
from sqlalchemy import Column, String, Boolean, Float, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base


class User(Base):
    __tablename__ = "users"

    # Integer surrogate key -- the live database's primary key (users_pkey).
    # Every appointment/chat/note foreign key references this column.
    id = Column(Integer, primary_key=True, index=True)

    # Stable public UUID. Unique, but *not* the primary key: the live schema
    # keeps `id` as the PK, so ORM identity must track it too.
    user_id = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    
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
    
    # Focus area for student onboarding recommendations
    student_role = Column(String, nullable=True)  # first-year, burnout, relationship stress, etc.

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
