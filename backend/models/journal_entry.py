"""
Journal Entry Model - Stores mood check-ins and reflective entries
"""

import uuid
from sqlalchemy import Column, String, DateTime, Text, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base
import enum


class MoodEnum(str, enum.Enum):
    CALM = "calm"
    ANXIOUS = "anxious"
    SAD = "sad"
    FRUSTRATED = "frustrated"
    HOPEFUL = "hopeful"
    NUMB = "numb"
    GRATEFUL = "grateful"
    OVERWHELMED = "overwhelmed"


class PromptCategoryEnum(str, enum.Enum):
    ACADEMIC = "academic"
    SOCIAL = "social"
    IDENTITY = "identity"
    GENERAL = "general"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    entry_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    anon_id = Column(String, index=True, nullable=False)  # Denormalized for query speed
    
    # Mood & Prompt
    mood_selected = Column(Enum(MoodEnum), nullable=False)
    prompt_category = Column(Enum(PromptCategoryEnum), nullable=False)
    
    # Entry content (encrypted at application level)
    entry_text = Column(Text, nullable=False)
    
    # AI Reflection from companion
    ai_reflection = Column(Text, nullable=True)
    
    # Sharing settings
    shared_anonymously = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
