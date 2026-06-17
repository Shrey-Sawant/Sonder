"""
Crisis Intervention API v1 - Risk detection and support (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime
from typing import Optional, List
import uuid

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.crisis_event import CrisisEvent, RiskLevelEnum
from core.encryption import decrypt_string

from pydantic import BaseModel

router = APIRouter(prefix="/crisis", tags=["crisis"])


# ===== SCHEMAS =====

class CrisisEventResponse(BaseModel):
    event_id: str
    risk_level: str
    source: str
    signal_text: Optional[str]
    intervention_shown: Optional[str]
    triggered_at: datetime
    
    class Config:
        from_attributes = True


# ===== ENDPOINTS =====

@router.get("/check")
async def check_for_crisis_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check for pending crisis events (unresponded to)
    Returns the highest risk event requiring intervention
    """
    try:
        # Get most recent crisis event
        stmt = (
            select(CrisisEvent)
            .where(
                CrisisEvent.user_id == current_user.user_id,
                CrisisEvent.resolved.is_(None)
            )
            .order_by(desc(CrisisEvent.triggered_at))
        )
        res = await db.execute(stmt)
        recent_event = res.scalars().first()
        
        if not recent_event:
            return {
                "intervention_needed": False,
                "type": "NONE"
            }
        
        # Determine intervention type
        intervention_type = "SOFT"
        if recent_event.risk_level == RiskLevelEnum.HIGH:
            intervention_type = "HARD"
        
        return {
            "intervention_needed": True,
            "type": intervention_type,
            "event_id": str(recent_event.event_id),
            "risk_level": recent_event.risk_level.value,
            "source": recent_event.source.value,
            "signal": decrypt_string(recent_event.signal_text) if recent_event.signal_text else None,
            "message": get_intervention_message(recent_event.risk_level)
        }
    
    except Exception as e:
        print(f"Error checking crisis events: {e}")
        raise HTTPException(status_code=500, detail="Error checking status")


@router.post("/events/resolve")
async def resolve_crisis_event(
    event_id: str,
    action: str,  # "booked_session", "dismissed", "contacted_support"
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a crisis event as resolved/responded to
    """
    try:
        stmt = select(CrisisEvent).where(
            CrisisEvent.event_id == uuid.UUID(event_id),
            CrisisEvent.user_id == current_user.user_id
        )
        res = await db.execute(stmt)
        event = res.scalars().first()
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event.user_took_action = action
        event.resolved = "yes"
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Event marked as resolved. Take care of yourself."
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error resolving crisis event: {e}")
        raise HTTPException(status_code=500, detail="Error resolving event")


@router.get("/events/history")
async def get_crisis_history(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's crisis event history"""
    try:
        stmt = (
            select(CrisisEvent)
            .where(CrisisEvent.user_id == current_user.user_id)
            .order_by(desc(CrisisEvent.triggered_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        events = res.scalars().all()
        
        return [
            {
                "event_id": str(event.event_id),
                "risk_level": event.risk_level.value,
                "source": event.source.value,
                "triggered_at": event.triggered_at,
                "resolved": event.resolved,
                "action_taken": event.user_took_action
            }
            for event in events
        ]
    
    except Exception as e:
        print(f"Error fetching crisis history: {e}")
        raise HTTPException(status_code=500, detail="Error fetching history")


@router.post("/notification-toggle")
async def toggle_crisis_notification(
    notify: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Student can toggle whether to notify their assigned counsellor on crisis
    """
    try:
        current_user.notify_on_crisis = notify
        await db.commit()
        
        return {
            "success": True,
            "notify_on_crisis": notify,
            "message": f"Counsellor notification {'enabled' if notify else 'disabled'}"
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error toggling notification: {e}")
        raise HTTPException(status_code=500, detail="Error toggling notification")


# ===== ADMIN ENDPOINTS =====

@router.get("/admin/flagged-messages")
async def get_flagged_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin endpoint to view flagged peer messages (moderation queue)
    """
    try:
        # Verify user is admin
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access only")
        
        from models.peer_message import PeerMessage
        stmt = select(PeerMessage).where(PeerMessage.flagged == True).order_by(desc(PeerMessage.sent_at))
        res = await db.execute(stmt)
        flagged = res.scalars().all()
        
        return [
            {
                "message_id": str(msg.message_id),
                "thread_id": str(msg.thread_id),
                "sender_anon_id": msg.sender_anon_id,
                "content": decrypt_string(msg.content) if msg.content else "",
                "flag_reason": msg.flag_reason,
                "sent_at": msg.sent_at
            }
            for msg in flagged
        ]
    
    except Exception as e:
        print(f"Error fetching flagged messages: {e}")
        raise HTTPException(status_code=500, detail="Error fetching queue")


# ===== UTILITY FUNCTIONS =====

def get_intervention_message(risk_level: RiskLevelEnum) -> str:
    """Get appropriate intervention message based on risk level"""
    messages = {
        RiskLevelEnum.LOW: "It sounds like things might be weighing on you. Want to talk to someone?",
        RiskLevelEnum.MEDIUM: "We're here for you. It sounds like things are getting heavy right now.",
        RiskLevelEnum.HIGH: "We're really concerned about your wellbeing. Please reach out to someone right now."
    }
    return messages.get(risk_level, "Support is available for you.")


# ===== CRISIS HOTLINE NUMBERS =====
CRISIS_HOTLINES = {
    "icall": {
        "name": "iCall (India)",
        "number": "9152987821",
        "website": "www.icallindia.org"
    },
    "vandrevala": {
        "name": "Vandrevala Foundation (India)",
        "number": "9999 66 4100",
        "website": "www.vandrevalafoundation.org"
    },
    "988": {
        "name": "988 Suicide & Crisis Lifeline (USA)",
        "number": "988",
        "website": "www.988lifeline.org"
    }
}


@router.get("/resources")
async def get_crisis_resources():
    """Get crisis support resources and hotline numbers"""
    return {
        "hotlines": CRISIS_HOTLINES,
        "message": "You're not alone. Help is available 24/7."
    }
