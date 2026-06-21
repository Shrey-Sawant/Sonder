"""
Peer Chat API v1 - Anonymous group and 1-on-1 peer messaging with WebSocket support
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, update
from datetime import datetime
from typing import Dict, List, Optional
import uuid
import json

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.peer_message import PeerMessage, ChatThread, ChatThreadTypeEnum
from models.crisis_event import CrisisEvent
from core.encryption import encrypt_string, decrypt_string
from services.crisis_detector import get_crisis_detector

from pydantic import BaseModel

router = APIRouter(prefix="/peer_chat", tags=["peer-chat"])


# ===== SCHEMAS =====

class ChatThreadCreate(BaseModel):
    thread_type: ChatThreadTypeEnum
    participants_anon_ids: List[str]


class ChatThreadResponse(BaseModel):
    thread_id: str
    thread_type: str
    participants_anon_ids: List[str]
    created_at: datetime
    last_message_at: Optional[datetime]

    class Config:
        from_attributes = True


class PeerMessageCreate(BaseModel):
    thread_id: str
    content: str


class PeerMessageResponse(BaseModel):
    message_id: str
    thread_id: str
    sender_anon_id: str
    content: str
    sent_at: datetime
    flagged: bool
    moderation_status: str
    moderation_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ReportMessageRequest(BaseModel):
    reason: str


# ===== WEBSOCKET CONNECTION MANAGER =====

class PeerConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, anon_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[anon_id] = websocket
        print(f"[WS] User {anon_id} connected. Active connections: {list(self.active_connections.keys())}")

    def disconnect(self, anon_id: str):
        if anon_id in self.active_connections:
            del self.active_connections[anon_id]
            print(f"[WS] User {anon_id} disconnected.")

    async def send_personal_message(self, message: dict, anon_id: str):
        if anon_id in self.active_connections:
            try:
                await self.active_connections[anon_id].send_json(message)
                return True
            except Exception as e:
                print(f"[WS] Failed to send to {anon_id}: {e}")
                return False
        return False

    async def broadcast_to_thread(self, thread_id: str, message: dict, participants: List[str]):
        print(f"[WS] Broadcasting message to thread {thread_id} for participants {participants}")
        for p in participants:
            await self.send_personal_message(message, p)


manager = PeerConnectionManager()


# ===== ENDPOINTS =====

@router.websocket("/ws/{anon_id}")
async def websocket_endpoint(websocket: WebSocket, anon_id: str):
    """
    WebSocket endpoint for real-time peer chat
    Connections are mapped by anon_id
    """
    await manager.connect(anon_id, websocket)
    try:
        while True:
            # Keep connection alive, listen for incoming messages if any
            data = await websocket.receive_text()
            # If front-end sends a ping, reply with pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(anon_id)
    except Exception as e:
        print(f"[WS] Connection error for {anon_id}: {e}")
        manager.disconnect(anon_id)


@router.post("/threads", response_model=ChatThreadResponse)
async def get_or_create_thread(
    request: ChatThreadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new chat thread (1-on-1 or Support Circle)
    For 1-on-1, checks if thread already exists between the same participants
    """
    try:
        # Guarantee sender is in participants
        if current_user.anon_id not in request.participants_anon_ids:
            request.participants_anon_ids.append(current_user.anon_id)

        # Remove duplicate IDs
        participants = sorted(list(set(request.participants_anon_ids)))

        if request.thread_type == ChatThreadTypeEnum.PEER_1ON1:
            if len(participants) != 2:
                raise HTTPException(status_code=400, detail="1-on-1 chat must have exactly 2 participants")

            # Check if 1-on-1 thread exists
            stmt = select(ChatThread).where(
                ChatThread.thread_type == ChatThreadTypeEnum.PEER_1ON1
            )
            res = await db.execute(stmt)
            threads = res.scalars().all()
            for t in threads:
                if sorted(t.participants_anon_ids) == participants:
                    return t

        # Create new thread
        new_thread = ChatThread(
            thread_id=uuid.uuid4(),
            thread_type=request.thread_type,
            participants_anon_ids=participants,
            created_at=datetime.utcnow()
        )
        db.add(new_thread)
        await db.commit()
        await db.refresh(new_thread)
        return new_thread

    except HTTPException as he:
        raise he
    except Exception as e:
        await db.rollback()
        print(f"Error creating thread: {e}")
        raise HTTPException(status_code=500, detail="Error creating thread")


@router.get("/threads", response_model=List[ChatThreadResponse])
async def get_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all threads that the user belongs to"""
    try:
        # ARRAY comparison filter: does participants_anon_ids contain current_user.anon_id?
        # Using any element comparison
        stmt = select(ChatThread).where(
            ChatThread.participants_anon_ids.any(current_user.anon_id)
        ).order_by(desc(ChatThread.last_message_at))
        res = await db.execute(stmt)
        return res.scalars().all()
    except Exception as e:
        print(f"Error listing threads: {e}")
        raise HTTPException(status_code=500, detail="Error listing threads")


@router.get("/messages/{thread_id}", response_model=List[PeerMessageResponse])
async def get_thread_messages(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message history for a thread (decrypted)"""
    try:
        t_uuid = uuid.UUID(thread_id)
        
        # Verify user is in thread
        stmt_thread = select(ChatThread).where(ChatThread.thread_id == t_uuid)
        res_thread = await db.execute(stmt_thread)
        thread = res_thread.scalars().first()
        
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
            
        if current_user.anon_id not in thread.participants_anon_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view messages in this thread")

        stmt_messages = (
            select(PeerMessage)
            .where(PeerMessage.thread_id == t_uuid)
            .order_by(PeerMessage.sent_at.asc())
        )
        res_messages = await db.execute(stmt_messages)
        messages = res_messages.scalars().all()

        results = []
        for msg in messages:
            results.append({
                "message_id": str(msg.message_id),
                "thread_id": str(msg.thread_id),
                "sender_anon_id": msg.sender_anon_id,
                "content": decrypt_string(msg.content) if msg.content else "",
                "sent_at": msg.sent_at,
                "flagged": msg.flagged,
                "moderation_status": msg.moderation_status,
                "moderation_reason": msg.moderation_reason
            })
        return results

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error listing messages: {e}")
        raise HTTPException(status_code=500, detail="Error listing messages")


@router.post("/messages", response_model=PeerMessageResponse)
async def send_peer_message(
    request: PeerMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a peer message
    - Encrypts text
    - Runs crisis keyword detection
    - Broadcasts over WebSockets
    """
    try:
        t_uuid = uuid.UUID(request.thread_id)
        
        # Verify user is in thread
        stmt_thread = select(ChatThread).where(ChatThread.thread_id == t_uuid)
        res_thread = await db.execute(stmt_thread)
        thread = res_thread.scalars().first()
        
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
            
        if current_user.anon_id not in thread.participants_anon_ids:
            raise HTTPException(status_code=403, detail="Not authorized to message this thread")

        # Check if the thread is a SUPPORT_CIRCLE to run custom moderation
        moderation_status = "SAFE"
        moderation_reason = None
        
        if thread.thread_type == ChatThreadTypeEnum.SUPPORT_CIRCLE:
            from models.circle import Circle
            from services.message_moderator import get_message_moderator
            
            stmt_circle = select(Circle).where(Circle.thread_id == thread.thread_id)
            res_circle = await db.execute(stmt_circle)
            circle = res_circle.scalars().first()
            
            if circle:
                moderator = get_message_moderator()
                moderation_result = await moderator.moderate_message(
                    request.content,
                    sensitivity_level=circle.sensitivity_level,
                    crisis_keywords=circle.crisis_keywords
                )
                moderation_status = moderation_result["status"]
                moderation_reason = moderation_result["reason"]
                
        # If BLOCK, raise HTTP 400
        if moderation_status == "BLOCK":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Message blocked: {moderation_reason}"
            )
            
        # Determine flagging
        flagged = False
        flag_reason = None
        if moderation_status == "HOLD":
            flagged = True
            flag_reason = f"Automated HOLD: {moderation_reason}"

        # Encrypt content
        encrypted_content = encrypt_string(request.content)
        
        # Save message
        message = PeerMessage(
            message_id=uuid.uuid4(),
            thread_id=t_uuid,
            sender_anon_id=current_user.anon_id,
            content=encrypted_content,
            flagged=flagged,
            flag_reason=flag_reason,
            moderation_status=moderation_status,
            moderation_reason=moderation_reason,
            sent_at=datetime.utcnow()
        )
        db.add(message)
        
        # Update thread last message time
        thread.last_message_at = datetime.utcnow()
        
        # Crisis detection
        detector = get_crisis_detector()
        crisis_result = await detector.assess_risk(
            request.content,
            source_type="chat"
        )
        
        crisis_detected = False
        crisis_level = None
        if crisis_result["requires_intervention"]:
            crisis_detected = True
            crisis_level = crisis_result["risk_level"]
            crisis_event = CrisisEvent(
                event_id=uuid.uuid4(),
                user_id=current_user.user_id,
                anon_id=current_user.anon_id,
                source="chat",
                source_id=message.message_id,
                risk_level=crisis_result["risk_level"].lower(),
                signal_text=encrypt_string(crisis_result["signal"]),
                ai_reasoning=crisis_result.get("signal", ""),
                triggered_at=datetime.utcnow()
            )
            db.add(crisis_event)

        await db.commit()
        await db.refresh(message)

        # Prepare WebSocket broadcast payload
        ws_payload = {
            "type": "NEW_PEER_MESSAGE",
            "payload": {
                "message_id": str(message.message_id),
                "thread_id": str(message.thread_id),
                "sender_anon_id": message.sender_anon_id,
                "content": request.content,
                "sent_at": message.sent_at.isoformat(),
                "flagged": message.flagged,
                "moderation_status": message.moderation_status,
                "moderation_reason": message.moderation_reason,
                "crisis_detected": crisis_detected,
                "crisis_level": crisis_level
            }
        }
        
        # Broadcast to all connected participants in the thread
        await manager.broadcast_to_thread(
            str(thread.thread_id),
            ws_payload,
            thread.participants_anon_ids
        )

        return {
            "message_id": str(message.message_id),
            "thread_id": str(message.thread_id),
            "sender_anon_id": message.sender_anon_id,
            "content": request.content,
            "sent_at": message.sent_at,
            "flagged": message.flagged,
            "moderation_status": message.moderation_status,
            "moderation_reason": message.moderation_reason
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        await db.rollback()
        print(f"Error sending peer message: {e}")
        raise HTTPException(status_code=500, detail="Error sending message")


@router.post("/messages/{message_id}/report")
async def report_peer_message(
    message_id: str,
    request: ReportMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Report/Flag a message
    Flagged messages go to admin queue
    """
    try:
        m_uuid = uuid.UUID(message_id)
        stmt = select(PeerMessage).where(PeerMessage.message_id == m_uuid)
        res = await db.execute(stmt)
        message = res.scalars().first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
            
        message.flagged = True
        message.flag_reason = request.reason
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Message reported. System moderators will review it shortly."
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        await db.rollback()
        print(f"Error reporting message: {e}")
        raise HTTPException(status_code=500, detail="Error reporting message")
