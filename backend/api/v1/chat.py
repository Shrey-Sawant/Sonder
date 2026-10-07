from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import aliased
from typing import Dict, List, Optional
from datetime import datetime
from db.session import get_db
from db.session import SessionLocal
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from models.user import User
from schemas.chat import ChatSessionCreate, ChatSessionResponse, ChatMessageCreate, ChatMessageResponse
from api.deps import extract_ws_token, get_current_user, ws_auth_subprotocol
from jose import JWTError, jwt
from config.settings import settings

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(
        self, user_id: int, websocket: WebSocket, subprotocol: Optional[str] = None
    ):
        await websocket.accept(subprotocol=subprotocol)
        self.active_connections[str(user_id)] = websocket

    def disconnect(self, user_id: int):
        u_id = str(user_id)
        if u_id in self.active_connections:
            del self.active_connections[u_id]

    async def send_personal_message(self, message: dict, user_id: int):
        u_id = str(user_id)
        if u_id in self.active_connections:
            try:
                await self.active_connections[u_id].send_json(message)
                return True
            except Exception:
                return False
        return False

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    token = extract_ws_token(websocket)
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise JWTError("Missing subject")
        async with SessionLocal() as db:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalars().first()
        if not user or user.id != user_id:
            await websocket.close(code=4403)
            return
    except JWTError:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket, ws_auth_subprotocol(websocket))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    session: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "student":
        if session.student_id != current_user.id or session.counsellor_id is None:
            raise HTTPException(status_code=403, detail="Not authorized to create this session")
        target_id = session.counsellor_id
        target_role = "counsellor"
    elif current_user.role == "counsellor":
        if session.counsellor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to create this session")
        target_id = session.student_id
        target_role = "student"
    else:
        raise HTTPException(status_code=403, detail="Not authorized to create chat sessions")

    target_result = await db.execute(
        select(User).where(
            User.id == target_id,
            User.role == target_role,
            User.is_verified.is_(True),
            User.is_approved.is_(True),
        )
    )
    if not target_result.scalars().first():
        raise HTTPException(status_code=404, detail="Chat participant not found")

    stmt = select(ChatSession).where(
        ChatSession.student_id == session.student_id,
        ChatSession.counsellor_id == session.counsellor_id,
        ChatSession.status == "active"
    )
    result = await db.execute(stmt)
    existing_session = result.scalars().first()

    if existing_session:
        return existing_session

    new_session = ChatSession(
        student_id=session.student_id,
        counsellor_id=session.counsellor_id,
        chat_type=session.chat_type,
        status="active",
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    await manager.send_personal_message({
        "type": "NEW_SESSION",
        "payload": {
            "id": str(new_session.id),
            "student_id": new_session.student_id,
            "student_name": current_user.username,
            "status": new_session.status,
            "updated_at": datetime.utcnow().isoformat()
        }
    }, session.counsellor_id)

    return new_session

@router.get("/sessions")
async def get_sessions(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    StudentUser = aliased(User)
    CounsellorUser = aliased(User)

    if current_user.role not in {"student", "counsellor"}:
        raise HTTPException(status_code=403, detail="Not authorized to view chat sessions")

    if current_user.role == "counsellor":
        stmt = (
            select(
                ChatSession.id,
                ChatSession.student_id,
                ChatSession.counsellor_id,
                ChatSession.status,
                ChatSession.created_at.label("updated_at"),
                StudentUser.username.label("student_name")
            )
            .join(StudentUser, ChatSession.student_id == StudentUser.id)
            .where(ChatSession.counsellor_id == current_user.id)
        )
    else:
        stmt = (
            select(
                ChatSession.id,
                ChatSession.student_id,
                ChatSession.counsellor_id,
                ChatSession.status,
                ChatSession.created_at.label("updated_at"),
                CounsellorUser.username.label("counsellor_name")
            )
            .join(CounsellorUser, ChatSession.counsellor_id == CounsellorUser.id)
            .where(ChatSession.student_id == current_user.id)
        )

    result = await db.execute(stmt)
    return [dict(row._asdict()) for row in result.all()]

@router.post("/messages", response_model=ChatMessageResponse)
async def send_message(
    message: ChatMessageCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    stmt = select(ChatSession).where(ChatSession.id == message.session_id)
    session_res = await db.execute(stmt)
    session = session_res.scalars().first()
    if not session or current_user.id not in {session.student_id, session.counsellor_id}:
        raise HTTPException(status_code=404, detail="Chat session not found")
    if current_user.role not in {"student", "counsellor"}:
        raise HTTPException(status_code=403, detail="Not authorized to send messages")

    new_message = ChatMessage(
        session_id=message.session_id,
        sender_role=current_user.role,
        message=message.message,
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    recipient_id = session.counsellor_id if current_user.role == "student" else session.student_id
    ws_payload = {
        "type": "NEW_MESSAGE",
        "payload": {
            "id": new_message.id,
            "session_id": str(new_message.session_id),
            "message": new_message.message,
            "sender_role": new_message.sender_role,
            "created_at": new_message.created_at.isoformat()
        }
    }
    await manager.send_personal_message(ws_payload, recipient_id)
    await manager.send_personal_message(ws_payload, current_user.id)

    return new_message

@router.get("/messages/{session_id}", response_model=List[ChatMessageResponse])
async def get_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = session_result.scalars().first()
    if not session or current_user.id not in {session.student_id, session.counsellor_id}:
        raise HTTPException(status_code=404, detail="Chat session not found")
    stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()
