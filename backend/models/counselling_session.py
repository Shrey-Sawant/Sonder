"""
Counselling Session Model - Video/audio sessions with anonymous support
"""

import uuid
from sqlalchemy import Column, String, DateTime, Text, Boolean, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base
import enum


class SessionStatusEnum(str, enum.Enum):
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class CounsellingSession(Base):
    __tablename__ = "counselling_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Participants - stored by anon_id and user_id
    student_anon_id = Column(String, nullable=False, index=True)
    student_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    counsellor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    
    # Video room
    room_url = Column(String, nullable=True)  # Daily.co room URL, expires after session
    room_token = Column(String, nullable=True)  # Session token
    
    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    
    # Anonymous mode toggle
    anon_mode = Column(Boolean, default=True)  # Video blurred if true
    
    # Session notes (counsellor-only, encrypted)
    session_notes_encrypted = Column(Text, nullable=True)
    
    # Recording settings
    recording_enabled = Column(Boolean, default=False)
    recording_url = Column(String, nullable=True)
    
    # Status tracking
    status = Column(Enum(SessionStatusEnum), default=SessionStatusEnum.SCHEDULED, index=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    
    # Post-session
    mood_check_sent = Column(Boolean, default=False)  # Auto mood check-in after 30min
    mood_check_response = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
