import uuid
from sqlalchemy import Column, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base


class Circle(Base):
    __tablename__ = "circles"

    circle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # References the ChatThread of type SUPPORT_CIRCLE
    thread_id = Column(UUID(as_uuid=True), ForeignKey("chat_threads.thread_id", ondelete="CASCADE"), nullable=False, unique=True)
    
    name = Column(String, unique=True, index=True, nullable=False)
    tagline = Column(String, nullable=False)
    welcome_message = Column(Text, nullable=False)
    rules = Column(JSON, nullable=False)  # list of rules
    opening_prompt = Column(Text, nullable=False)
    
    # Moderation parameters
    sensitivity_level = Column(String, default="medium", nullable=False)  # low, medium, high
    crisis_keywords = Column(JSON, nullable=False)  # list of crisis words
    
    # Matching categorization
    theme = Column(String, nullable=False)
    type = Column(String, nullable=False)  # student role focus
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
