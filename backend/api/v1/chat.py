from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from schemas.chat import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
)
from models.user import User
from api.deps import get_current_user

router = APIRouter()


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    session: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_session = ChatSession(
        student_id=session.student_id,
        counsellor_id=session.counsellor_id,
        chat_type=session.chat_type,
        status=session.status,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def get_sessions(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    # Simple logic: users see their own sessions
    if current_user.role == "student":
        stmt = select(ChatSession).where(ChatSession.student_id == current_user.id)
    elif current_user.role == "counsellor":
        stmt = select(ChatSession).where(ChatSession.counsellor_id == current_user.id)
    else:
        # Admin sees all? Or maybe just own? currently all for simplicity or nothing
        stmt = select(ChatSession)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/messages", response_model=ChatMessageResponse)
async def send_message(
    message: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify session exists and user is part of it could be added here
    new_message = ChatMessage(
        session_id=message.session_id,
        sender_role=message.sender_role,
        message=message.message,
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    return new_message


@router.get("/messages/{session_id}", response_model=list[ChatMessageResponse])
async def get_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
