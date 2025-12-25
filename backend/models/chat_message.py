from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from db.session import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)

    session_id = Column(
        Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )

    sender_role = Column(String, nullable=False)  # student | counsellor | ai
    message = Column(Text, nullable=False)

    created_at = Column(DateTime, server_default=func.now())
