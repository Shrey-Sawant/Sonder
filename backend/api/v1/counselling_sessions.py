"""
Counselling Sessions API v1 - Video sessions with optional anonymity (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import Optional, List
import uuid

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.counselling_session import CounsellingSession, SessionStatusEnum
from core.encryption import encrypt_string, decrypt_string

from pydantic import BaseModel

router = APIRouter(prefix="/sessions", tags=["counselling-sessions"])


# ===== SCHEMAS =====

class BookSessionRequest(BaseModel):
    counsellor_id: str
    scheduled_at: datetime
    duration_minutes: int = 60
    anon_mode: bool = True  # Default to anonymous


class JoinSessionRequest(BaseModel):
    join_with_anonymity: bool = True


class SessionNotesRequest(BaseModel):
    notes: str


class SessionResponse(BaseModel):
    session_id: str
    scheduled_at: datetime
    duration_minutes: int
    anon_mode: bool
    status: str
    
    class Config:
        from_attributes = True


# ===== ENDPOINTS =====

@router.post("/book", response_model=SessionResponse)
async def book_counselling_session(
    request: BookSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Book a counselling session
    """
    try:
        # Verify counsellor exists and is verified
        stmt = select(User).where(
            User.user_id == uuid.UUID(request.counsellor_id),
            User.role == "counsellor"
        )
        res = await db.execute(stmt)
        counsellor = res.scalars().first()
        
        if not counsellor:
            raise HTTPException(status_code=404, detail="Counsellor not found or not verified")
        
        # Check if time is in future
        if request.scheduled_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
        
        # Create session
        session = CounsellingSession(
            session_id=uuid.uuid4(),
            student_anon_id=current_user.anon_id,
            student_user_id=current_user.user_id,
            counsellor_id=counsellor.user_id,
            scheduled_at=request.scheduled_at,
            duration_minutes=request.duration_minutes,
            anon_mode=request.anon_mode,
            status=SessionStatusEnum.SCHEDULED
        )
        
        # Generate room URL
        session.room_url = f"https://sonder-sessions.daily.co/{session.session_id}"
        session.room_token = f"token_{session.session_id}"
        
        db.add(session)
        await db.commit()
        
        return {
            "session_id": str(session.session_id),
            "scheduled_at": session.scheduled_at,
            "duration_minutes": session.duration_minutes,
            "anon_mode": session.anon_mode,
            "status": session.status.value
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error booking session: {e}")
        raise HTTPException(status_code=500, detail="Error booking session")


@router.get("/list", response_model=List[SessionResponse])
async def list_counselling_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List counselling sessions that the user belongs to"""
    try:
        if current_user.role == "counsellor":
            stmt = select(CounsellingSession).where(CounsellingSession.counsellor_id == current_user.user_id)
        else:
            stmt = select(CounsellingSession).where(CounsellingSession.student_user_id == current_user.user_id)
            
        res = await db.execute(stmt)
        sessions = res.scalars().all()
        return [
            {
                "session_id": str(s.session_id),
                "scheduled_at": s.scheduled_at,
                "duration_minutes": s.duration_minutes,
                "anon_mode": s.anon_mode,
                "status": s.status.value
            }
            for s in sessions
        ]
    except Exception as e:
        print(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail="Error listing sessions")


@router.post("/{session_id}/join")
async def get_session_join_info(
    session_id: str,
    join_request: JoinSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get session join information
    """
    try:
        stmt = select(CounsellingSession).where(
            CounsellingSession.session_id == uuid.UUID(session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify user is participant
        is_student = session.student_user_id == current_user.user_id
        is_counsellor = session.counsellor_id == current_user.user_id
        
        if not (is_student or is_counsellor):
            raise HTTPException(status_code=403, detail="Not authorized to join this session")
        
        # Check session is scheduled or ongoing
        if session.status not in [SessionStatusEnum.SCHEDULED, SessionStatusEnum.ONGOING]:
            raise HTTPException(status_code=410, detail=f"Session is {session.status.value}")
        
        # Update anonymity mode if this is the student
        if is_student and join_request.join_with_anonymity is not None:
            session.anon_mode = join_request.join_with_anonymity
        
        await db.commit()
        
        # Prepare display names
        if is_student:
            student_display = session.student_anon_id if session.anon_mode else current_user.username
            counsellor_display = "Counsellor · Sonder Institution"
        else:
            student_display = session.student_anon_id
            counsellor_display = current_user.username if not session.anon_mode else f"Counsellor · Sonder Institution"
        
        return {
            "session_id": str(session.session_id),
            "room_url": session.room_url,
            "room_token": session.room_token,
            "anon_mode": session.anon_mode,
            "student_display": student_display,
            "counsellor_display": counsellor_display,
            "duration_minutes": session.duration_minutes,
            "recording_enabled": session.recording_enabled
        }
    
    except Exception as e:
        print(f"Error getting join info: {e}")
        raise HTTPException(status_code=500, detail="Error getting session info")


@router.post("/{session_id}/start")
async def start_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark session as ongoing"""
    try:
        stmt = select(CounsellingSession).where(
            CounsellingSession.session_id == uuid.UUID(session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.status != SessionStatusEnum.SCHEDULED:
            raise HTTPException(status_code=400, detail="Session must be scheduled to start")
        
        session.status = SessionStatusEnum.ONGOING
        session.started_at = datetime.utcnow()
        await db.commit()
        
        return {"success": True, "status": "ongoing"}
    
    except Exception as e:
        await db.rollback()
        print(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail="Error starting session")


@router.post("/{session_id}/end")
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark session as completed
    """
    try:
        stmt = select(CounsellingSession).where(
            CounsellingSession.session_id == uuid.UUID(session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.status != SessionStatusEnum.ONGOING:
            raise HTTPException(status_code=400, detail="Session must be ongoing to end")
        
        session.status = SessionStatusEnum.COMPLETED
        session.ended_at = datetime.utcnow()
        session.mood_check_sent = False  # Will be sent by scheduled task after 30 min
        
        await db.commit()
        
        # Schedule the post-session check-in task
        try:
            from services.scheduler import scheduler, send_post_session_mood_check
            run_time = datetime.utcnow() + timedelta(minutes=30)
            scheduler.add_job(
                send_post_session_mood_check,
                trigger="date",
                run_date=run_time,
                args=[str(session.session_id)],
                id=f"mood_check_{session.session_id}",
                replace_existing=True
            )
            print(f"[SCHEDULER] Scheduled mood check for session {session.session_id} at {run_time}")
        except Exception as se:
            print(f"[SCHEDULER] Failed to schedule background check-in: {se}")
        
        return {
            "success": True,
            "status": "completed",
            "message": "Session ended. Mood check-in will be sent in 30 minutes."
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error ending session: {e}")
        raise HTTPException(status_code=500, detail="Error ending session")


@router.post("/{session_id}/notes")
async def add_session_notes(
    session_id: str,
    request: SessionNotesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add encrypted session notes (counsellor only)
    """
    try:
        stmt = select(CounsellingSession).where(
            CounsellingSession.session_id == uuid.UUID(session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Only counsellor can add notes
        if session.counsellor_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Only counsellor can add notes")
        
        # Encrypt notes
        encrypted_notes = encrypt_string(request.notes)
        session.session_notes_encrypted = encrypted_notes
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Session notes saved securely"
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error adding session notes: {e}")
        raise HTTPException(status_code=500, detail="Error adding notes")


@router.get("/{session_id}/notes")
async def get_session_notes(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get encrypted session notes (counsellor only)"""
    try:
        stmt = select(CounsellingSession).where(
            CounsellingSession.session_id == uuid.UUID(session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Only counsellor can view notes
        if session.counsellor_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Only counsellor can view notes")
        
        decrypted_notes = decrypt_string(session.session_notes_encrypted) if session.session_notes_encrypted else None
        
        return {
            "session_id": str(session.session_id),
            "notes": decrypted_notes
        }
    
    except Exception as e:
        print(f"Error fetching notes: {e}")
        raise HTTPException(status_code=500, detail="Error fetching notes")
