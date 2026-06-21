"""
Circles API Router - support circle creation, joining, recommendations, and search
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
import uuid
import datetime

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.circle import Circle
from models.peer_message import ChatThread, ChatThreadTypeEnum
from services.circle_generator import get_circle_generator
from services.circle_recommender import get_circle_recommender

from pydantic import BaseModel

router = APIRouter(prefix="/circles", tags=["circles"])


# ===== SCHEMAS =====

class CircleGenerateRequest(BaseModel):
    theme: str
    type: str  # student role focus


class CircleCreateRequest(BaseModel):
    name: str
    tagline: str
    welcome_message: str
    rules: List[str]
    opening_prompt: str
    sensitivity_level: str
    crisis_keywords: List[str]
    theme: str
    type: str


class CircleResponse(BaseModel):
    circle_id: str
    thread_id: str
    name: str
    tagline: str
    welcome_message: str
    rules: List[str]
    opening_prompt: str
    sensitivity_level: str
    theme: str
    type: str
    created_at: datetime.datetime
    participants_count: int
    is_member: bool

    class Config:
        from_attributes = True


# ===== ENDPOINTS =====

@router.post("/generate")
async def generate_circle_preview(
    request: CircleGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate configuration preview for a new Support Circle using AI"""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can generate support circles"
        )
    generator = get_circle_generator()
    preview = await generator.generate_circle_preview(request.theme, request.type)
    return preview


@router.post("/create", response_model=CircleResponse)
async def create_circle(
    request: CircleCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Support Circle and its associated messaging thread"""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can create support circles"
        )
        
    # Check uniqueness of name
    stmt = select(Circle).where(Circle.name == request.name)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A circle with this name already exists"
        )
        
    try:
        # 1. Create a ChatThread for this support circle
        # Owner is the first participant
        new_thread = ChatThread(
            thread_id=uuid.uuid4(),
            thread_type=ChatThreadTypeEnum.SUPPORT_CIRCLE,
            participants_anon_ids=[current_user.anon_id],
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_thread)
        
        # 2. Create the Circle record referencing this thread
        new_circle = Circle(
            circle_id=uuid.uuid4(),
            thread_id=new_thread.thread_id,
            name=request.name,
            tagline=request.tagline,
            welcome_message=request.welcome_message,
            rules=request.rules,
            opening_prompt=request.opening_prompt,
            sensitivity_level=request.sensitivity_level.lower(),
            crisis_keywords=request.crisis_keywords,
            theme=request.theme,
            type=request.type,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_circle)
        
        await db.commit()
        await db.refresh(new_circle)
        
        return {
            "circle_id": str(new_circle.circle_id),
            "thread_id": str(new_circle.thread_id),
            "name": new_circle.name,
            "tagline": new_circle.tagline,
            "welcome_message": new_circle.welcome_message,
            "rules": new_circle.rules,
            "opening_prompt": new_circle.opening_prompt,
            "sensitivity_level": new_circle.sensitivity_level,
            "theme": new_circle.theme,
            "type": new_circle.type,
            "created_at": new_circle.created_at,
            "participants_count": 1,
            "is_member": True
        }
        
    except Exception as e:
        await db.rollback()
        print(f"Error creating circle: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create support circle"
        )


@router.get("/recommendations", response_model=List[CircleResponse])
async def get_recommended_circles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve personalized Support Circle recommendations for the student"""
    if current_user.role != "student":
        return []
        
    recommender = get_circle_recommender()
    recommended_list = await recommender.get_recommendations(current_user, db)
    
    results = []
    for circle in recommended_list:
        # Load thread to check membership & count
        stmt_thread = select(ChatThread).where(ChatThread.thread_id == circle.thread_id)
        res_thread = await db.execute(stmt_thread)
        thread = res_thread.scalars().first()
        
        is_member = current_user.anon_id in thread.participants_anon_ids if thread else False
        p_count = len(thread.participants_anon_ids) if thread else 0
        
        results.append({
            "circle_id": str(circle.circle_id),
            "thread_id": str(circle.thread_id),
            "name": circle.name,
            "tagline": circle.tagline,
            "welcome_message": circle.welcome_message,
            "rules": circle.rules,
            "opening_prompt": circle.opening_prompt,
            "sensitivity_level": circle.sensitivity_level,
            "theme": circle.theme,
            "type": circle.type,
            "created_at": circle.created_at,
            "participants_count": p_count,
            "is_member": is_member
        })
        
    return results


@router.get("/all", response_model=List[CircleResponse])
async def get_all_circles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all support circles on the platform"""
    stmt = select(Circle).order_by(Circle.created_at.desc())
    res = await db.execute(stmt)
    circles = res.scalars().all()
    
    results = []
    for circle in circles:
        # Check thread membership
        stmt_thread = select(ChatThread).where(ChatThread.thread_id == circle.thread_id)
        res_thread = await db.execute(stmt_thread)
        thread = res_thread.scalars().first()
        
        is_member = current_user.anon_id in thread.participants_anon_ids if thread else False
        p_count = len(thread.participants_anon_ids) if thread else 0
        
        results.append({
            "circle_id": str(circle.circle_id),
            "thread_id": str(circle.thread_id),
            "name": circle.name,
            "tagline": circle.tagline,
            "welcome_message": circle.welcome_message,
            "rules": circle.rules,
            "opening_prompt": circle.opening_prompt,
            "sensitivity_level": circle.sensitivity_level,
            "theme": circle.theme,
            "type": circle.type,
            "created_at": circle.created_at,
            "participants_count": p_count,
            "is_member": is_member
        })
        
    return results


@router.post("/{circle_id}/join", response_model=CircleResponse)
async def join_circle(
    circle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Join an anonymous Support Circle (add to ChatThread participants)"""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can join support circles"
        )
        
    stmt_circle = select(Circle).where(Circle.circle_id == uuid.UUID(circle_id))
    res_circle = await db.execute(stmt_circle)
    circle = res_circle.scalars().first()
    
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support circle not found"
        )
        
    stmt_thread = select(ChatThread).where(ChatThread.thread_id == circle.thread_id)
    res_thread = await db.execute(stmt_thread)
    thread = res_thread.scalars().first()
    
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated chat thread not found"
        )
        
    # Join logic
    participants = list(thread.participants_anon_ids)
    if current_user.anon_id not in participants:
        participants.append(current_user.anon_id)
        # SQLAlchemy array mutation notice
        thread.participants_anon_ids = participants
        await db.commit()
        await db.refresh(thread)
        
    return {
        "circle_id": str(circle.circle_id),
        "thread_id": str(circle.thread_id),
        "name": circle.name,
        "tagline": circle.tagline,
        "welcome_message": circle.welcome_message,
        "rules": circle.rules,
        "opening_prompt": circle.opening_prompt,
        "sensitivity_level": circle.sensitivity_level,
        "theme": circle.theme,
        "type": circle.type,
        "created_at": circle.created_at,
        "participants_count": len(thread.participants_anon_ids),
        "is_member": True
    }


@router.post("/{circle_id}/leave", response_model=CircleResponse)
async def leave_circle(
    circle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave an anonymous Support Circle (remove from ChatThread participants)"""
    stmt_circle = select(Circle).where(Circle.circle_id == uuid.UUID(circle_id))
    res_circle = await db.execute(stmt_circle)
    circle = res_circle.scalars().first()
    
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support circle not found"
        )
        
    stmt_thread = select(ChatThread).where(ChatThread.thread_id == circle.thread_id)
    res_thread = await db.execute(stmt_thread)
    thread = res_thread.scalars().first()
    
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated chat thread not found"
        )
        
    # Leave logic
    participants = list(thread.participants_anon_ids)
    if current_user.anon_id in participants:
        participants.remove(current_user.anon_id)
        thread.participants_anon_ids = participants
        await db.commit()
        await db.refresh(thread)
        
    return {
        "circle_id": str(circle.circle_id),
        "thread_id": str(circle.thread_id),
        "name": circle.name,
        "tagline": circle.tagline,
        "welcome_message": circle.welcome_message,
        "rules": circle.rules,
        "opening_prompt": circle.opening_prompt,
        "sensitivity_level": circle.sensitivity_level,
        "theme": circle.theme,
        "type": circle.type,
        "created_at": circle.created_at,
        "participants_count": len(thread.participants_anon_ids),
        "is_member": False
    }


@router.get("/{circle_id}", response_model=CircleResponse)
async def get_circle_details(
    circle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single Support Circle parameters"""
    stmt_circle = select(Circle).where(Circle.circle_id == uuid.UUID(circle_id))
    res_circle = await db.execute(stmt_circle)
    circle = res_circle.scalars().first()
    
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Support circle not found"
        )
        
    stmt_thread = select(ChatThread).where(ChatThread.thread_id == circle.thread_id)
    res_thread = await db.execute(stmt_thread)
    thread = res_thread.scalars().first()
    
    is_member = current_user.anon_id in thread.participants_anon_ids if thread else False
    p_count = len(thread.participants_anon_ids) if thread else 0
    
    return {
        "circle_id": str(circle.circle_id),
        "thread_id": str(circle.thread_id),
        "name": circle.name,
        "tagline": circle.tagline,
        "welcome_message": circle.welcome_message,
        "rules": circle.rules,
        "opening_prompt": circle.opening_prompt,
        "sensitivity_level": circle.sensitivity_level,
        "theme": circle.theme,
        "type": circle.type,
        "created_at": circle.created_at,
        "participants_count": p_count,
        "is_member": is_member
    }
