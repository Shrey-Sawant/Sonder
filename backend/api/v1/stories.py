"""
Story Feed API v1 - Anonymous story sharing and resonance (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime
from typing import List
import uuid

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.shared_story import SharedStory

from pydantic import BaseModel

router = APIRouter(prefix="/stories", tags=["stories"])


# ===== SCHEMAS =====

class StoryCardResponse(BaseModel):
    story_id: str
    author_anon_id: str
    mood: str
    excerpt: str
    resonance_count: int
    published_at: datetime
    
    class Config:
        from_attributes = True


# ===== ENDPOINTS =====

@router.get("", response_model=List[StoryCardResponse])
async def get_story_feed(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get anonymous story feed
    - Reverse chronological order (newest first)
    - Shows: AnonID + mood + excerpt (120 chars)
    """
    try:
        stmt = (
            select(SharedStory)
            .where(SharedStory.active == True)
            .order_by(desc(SharedStory.published_at))
            .limit(limit)
            .offset(offset)
        )
        res = await db.execute(stmt)
        stories = res.scalars().all()
        
        return [
            {
                "story_id": str(story.story_id),
                "author_anon_id": story.author_anon_id,
                "mood": story.mood,
                "excerpt": story.excerpt,
                "resonance_count": story.resonance_count,
                "published_at": story.published_at
            }
            for story in stories
        ]
    
    except Exception as e:
        print(f"Error fetching stories: {e}")
        raise HTTPException(status_code=500, detail="Error fetching stories")


@router.post("/{story_id}/resonate")
async def resonate_with_story(
    story_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark story as 'I felt this too'
    - Increments resonance_count
    """
    try:
        stmt = select(SharedStory).where(
            SharedStory.story_id == uuid.UUID(story_id)
        )
        res = await db.execute(stmt)
        story = res.scalars().first()
        
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        if not story.active:
            raise HTTPException(status_code=410, detail="Story is no longer available")
        
        # Increment resonance counter
        story.resonance_count += 1
        await db.commit()
        
        return {
            "success": True,
            "resonance_count": story.resonance_count,
            "message": "Your resonance has been shared anonymously"
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error marking resonance: {e}")
        raise HTTPException(status_code=500, detail="Error marking resonance")


@router.get("/{story_id}")
async def get_story_details(
    story_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get full story details"""
    try:
        stmt = select(SharedStory).where(
            SharedStory.story_id == uuid.UUID(story_id)
        )
        res = await db.execute(stmt)
        story = res.scalars().first()
        
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        if not story.active:
            raise HTTPException(status_code=410, detail="Story is no longer available")
        
        return {
            "story_id": str(story.story_id),
            "author_anon_id": story.author_anon_id,
            "mood": story.mood,
            "excerpt": story.excerpt,
            "resonance_count": story.resonance_count,
            "published_at": story.published_at,
            "created_at": story.created_at
        }
    
    except Exception as e:
        print(f"Error fetching story details: {e}")
        raise HTTPException(status_code=500, detail="Error fetching story")


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Author can delete their own shared story"""
    try:
        stmt = select(SharedStory).where(
            SharedStory.story_id == uuid.UUID(story_id)
        )
        res = await db.execute(stmt)
        story = res.scalars().first()
        
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Verify ownership (check anon_id)
        if story.author_anon_id != current_user.anon_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this story")
        
        story.active = False
        await db.commit()
        
        return {"success": True, "message": "Story removed from feed"}
    
    except Exception as e:
        await db.rollback()
        print(f"Error deleting story: {e}")
        raise HTTPException(status_code=500, detail="Error deleting story")
