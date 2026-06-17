"""
Peer Chat Models - Anonymous messaging system
"""

import uuid
from sqlalchemy import Column, String, DateTime, Text, Boolean, Enum, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base
import enum


class ChatThreadTypeEnum(str, enum.Enum):
    PEER_1ON1 = "peer_1on1"
    SUPPORT_CIRCLE = "support_circle"


class ChatThread(Base):
    __tablename__ = "chat_threads"

    thread_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Thread metadata
    thread_type = Column(Enum(ChatThreadTypeEnum), nullable=False)
    
    # Participants stored as array of anon_ids (anonymous only)
    participants_anon_ids = Column(ARRAY(String), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_message_at = Column(DateTime, nullable=True)


class PeerMessage(Base):
    __tablename__ = "peer_messages"

    message_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Thread reference
    thread_id = Column(UUID(as_uuid=True), ForeignKey("chat_threads.thread_id"), nullable=False, index=True)
    
    # Sender - stored as anon_id, never user_id
    sender_anon_id = Column(String, nullable=False, index=True)
    
    # Message content (encrypted at application level)
    content = Column(Text, nullable=False)
    
    # Moderation
    flagged = Column(Boolean, default=False)
    flag_reason = Column(String, nullable=True)
    
    # Timestamps
    sent_at = Column(DateTime, server_default=func.now(), nullable=False)
