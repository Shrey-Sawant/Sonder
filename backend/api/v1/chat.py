from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import aliased
from typing import Dict, List
from datetime import datetime
from db.session import get_db
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from models.user import User
from schemas.chat import ChatSessionCreate, ChatSessionResponse, ChatMessageCreate, ChatMessageResponse
from api.deps import get_current_user

router = APIRouter()


# --- Connection Manager ---
class ConnectionManager:
    def __init__(self):
        # We store keys as strings to avoid 15 vs "15" mismatch
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[str(user_id)] = websocket
        print(f"✅ WS Connected: User {user_id}. Active users: {list(self.active_connections.keys())}")

    def disconnect(self, user_id: int):
        u_id = str(user_id)
        if u_id in self.active_connections:
            del self.active_connections[u_id]
            print(f"❌ WS Disconnected: User {user_id}")

    async def send_personal_message(self, message: dict, user_id: int):
        u_id = str(user_id)
        if u_id in self.active_connections:
            try:
                await self.active_connections[u_id].send_json(message)
                return True
            except Exception as e:
                print(f"⚠️ Error sending to {u_id}: {e}")
                return False
        return False

manager = ConnectionManager()

# --- WebSocket ---
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep alive and listen for any incoming client signals
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WS Exception for {user_id}: {e}")
        manager.disconnect(user_id)

# --- Sessions ---
@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    session: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check for existing active session
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

    # Use created_at instead of updated_at
    timestamp = new_session.created_at.isoformat() if hasattr(new_session, 'created_at') else datetime.utcnow().isoformat()

    # Notify Counsellor
    await manager.send_personal_message({
        "type": "NEW_SESSION",
        "payload": {
            "id": new_session.id,
            "student_id": new_session.student_id,
            "student_name": current_user.username,
            "status": new_session.status,
            "created_at": timestamp 
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

    if current_user.role == "counsellor":
        # JOIN with User table to get the Student's Name
        stmt = (
            select(
                ChatSession.id,
                ChatSession.student_id,
                ChatSession.counsellor_id,
                ChatSession.status,
                ChatSession.created_at, # Fixed attribute name here
                StudentUser.username.label("student_name")
            )
            .join(StudentUser, ChatSession.student_id == StudentUser.id)
            .where(ChatSession.counsellor_id == current_user.id)
        )
    else:
        # JOIN with User table to get the Counsellor's Name
        stmt = (
            select(
                ChatSession.id,
                ChatSession.student_id,
                ChatSession.counsellor_id,
                ChatSession.status,
                ChatSession.created_at, # Fixed attribute name here
                CounsellorUser.username.label("student_name")
            )
            .join(CounsellorUser, ChatSession.counsellor_id == CounsellorUser.id)
            .where(ChatSession.student_id == current_user.id)
        )

    result = await db.execute(stmt)
    # Convert Row objects to dictionaries so frontend can read 'student_name'
    return [dict(row._asdict()) for row in result.all()]

# --- Messages ---
@router.post("/messages", response_model=ChatMessageResponse)
async def send_message(
    message: ChatMessageCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # 1. Save to Database
    new_message = ChatMessage(
        session_id=message.session_id,
        sender_role=message.sender_role,
        message=message.message
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    # --- PASTE THE CODE HERE ---
    
    # 2. WebSocket Logic: Get the session to find out who the recipient is
    stmt = select(ChatSession).where(ChatSession.id == message.session_id)
    session_res = await db.execute(stmt)
    session = session_res.scalars().first()
    
    if session:
        # Determine Recipient (The one who is NOT the current_user)
        curr_id = int(current_user.id)
        s_id = int(session.student_id)
        c_id = int(session.counsellor_id)
        
        recipient_id = c_id if curr_id == s_id else s_id
        
        ws_payload = {
            "type": "NEW_MESSAGE",
            "payload": {
                "id": new_message.id,
                "session_id": new_message.session_id,
                "message": new_message.message,
                "sender_role": new_message.sender_role,
                "created_at": new_message.created_at.isoformat()
            }
        }
        
        # 3. Push to Recipient
        delivered = await manager.send_personal_message(ws_payload, recipient_id)
        
        # 4. Push back to Sender (Updates their own Dashboard/Sidebar if open)
        await manager.send_personal_message(ws_payload, curr_id)

        if not delivered:
            print(f"Message saved to DB but recipient {recipient_id} not online via WS")

    return new_message

@router.get("/messages/{session_id}", response_model=List[ChatMessageResponse])
async def get_messages(
    session_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
