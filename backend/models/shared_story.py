"""
Shared Stories Model - Anonymous journal entry sharing
"""

import uuid
from sqlalchemy import Column, String, DateTime, Text, Boolean, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base


class SharedStory(Base):
    __tablename__ = "shared_stories"

    story_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Source journal entry
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.entry_id"), nullable=False, unique=True)
    
    # Author (always anonymous, no user_id stored)
    author_anon_id = Column(String, nullable=False, index=True)
    
    # Story content
    excerpt = Column(Text, nullable=False)  # First 120 chars of journal
    mood = Column(String, nullable=False)  # From mood_selected
    full_entry_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to full entry if needed
    
    # AI extracted metadata
    theme = Column(String, nullable=True)
    resonance_hook = Column(String, nullable=True)
    
    # Engagement metrics
    resonance_count = Column(Integer, default=0)  # "I felt this too" counter
    
    # Content moderation
    moderated = Column(Boolean, default=True)
    moderation_notes = Column(String, nullable=True)
    
    # Publishing
    active = Column(Boolean, default=True)
    published_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
