"""
Crisis Event Model - Track emotional risk signals and interventions
"""

import uuid
from sqlalchemy import Column, String, DateTime, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base
import enum


class CrisisSourceEnum(str, enum.Enum):
    JOURNAL = "journal"
    CHAT = "chat"
    MOOD_STREAK = "mood_streak"


class RiskLevelEnum(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CrisisEvent(Base):
    __tablename__ = "crisis_events"

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    anon_id = Column(String, index=True, nullable=False)
    
    # Event source
    source = Column(Enum(CrisisSourceEnum), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to journal_entry_id, message_id, etc.
    
    # Risk assessment
    risk_level = Column(Enum(RiskLevelEnum), nullable=False, index=True)
    
    # Signal details (encrypted)
    signal_text = Column(Text, nullable=True)  # The actual text that triggered it
    ai_reasoning = Column(Text, nullable=True)  # Why the AI flagged it
    
    # Intervention tracking
    intervention_shown = Column(String, nullable=True)  # Which banner/modal was shown
    user_took_action = Column(String, nullable=True)  # What the user did (e.g., "booked_session")
    
    # Counsellor notification
    counsellor_notified = Column(String, nullable=True)  # Should be "yes" or "no" or null if not applicable
    counsellor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    
    # Follow-up
    follow_up_sent = Column(String, nullable=True)  # e.g., "reminder_24h"
    resolved = Column(String, nullable=True)  # yes, no, pending
    
    # Timestamps
    triggered_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
