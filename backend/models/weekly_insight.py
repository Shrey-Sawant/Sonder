"""
Weekly Insights Model - Emotional patterns and AI-generated insights
"""

import uuid
from sqlalchemy import Column, Date, DateTime, Text, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base


class WeeklyInsight(Base):
    __tablename__ = "weekly_insights"

    insight_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User reference
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)
    
    # Week identifier
    week_start = Column(Date, nullable=False, index=True)
    
    # Generated insights (from AI)
    observation = Column(Text, nullable=False)  # "You felt anxious 6 of 7 days this week"
    reframe = Column(Text, nullable=False)  # Gentle reframe of the pattern
    micro_action = Column(Text, nullable=False)  # Small, doable suggestion
    
    # Metadata
    mood_frequency_data = Column(Text, nullable=True)  # JSON: {mood: count, ...}
    trigger_categories = Column(Text, nullable=True)  # JSON: {category: count, ...}
    time_of_day_pattern = Column(String, nullable=True)  # e.g., "9pm-11pm" 
    positive_streaks = Column(Text, nullable=True)  # JSON: [{dates, mood}, ...]
    
    # Engagement
    viewed = Column(Boolean, default=False)
    viewed_at = Column(DateTime, nullable=True)
    
    # Timestamps
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
