"""
Story Feed API v1 - Anonymous story sharing and resonance (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional
import uuid
import random
import re

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.shared_story import SharedStory
from models.checkin import CheckIn
from models.journal_entry import JournalEntry
from core.encryption import decrypt_string

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
    theme: Optional[str] = None
    resonance_hook: Optional[str] = None
    
    class Config:
        from_attributes = True


# ===== CURATED RESONANCE RESPONSES =====

RESONANCE_RESPONSES = [
    "Your silent nod carries weight; in sharing this quiet space, the burden feels a tiny bit lighter today.",
    "By feeling these echoes, you weave a soft thread of quiet understanding across the gaps of our isolation.",
    "A quiet connection ripples outward through your gentle touch, bringing a soft warmth to this long anonymous night.",
    "Your heart recognized this truth; thank you for holding safe space for another soul's quiet, unspoken midnight thoughts.",
    "Two strangers share a single breath of relief; in this vast digital ocean, your own simple resonance matters.",
    "You have left a warm trace of empathy here, reminding another student that their silent struggles are witnessed."
]


# ===== ENDPOINTS =====

@router.get("", response_model=List[StoryCardResponse])
async def get_story_feed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get personalized and anti-addictive anonymous story feed
    - Personalized blend of relevance and wildcard stories
    - Enforces 10-story limit
    """
    try:
        # Fetch all active stories
        stmt = select(SharedStory).where(SharedStory.active == True)
        res = await db.execute(stmt)
        all_stories = res.scalars().all()
        
        if not all_stories:
            return []
            
        # Fetch user's recent journal entries for mood and text matching
        stmt_journals = (
            select(JournalEntry)
            .where(JournalEntry.user_id == current_user.user_id)
            .order_by(desc(JournalEntry.created_at))
            .limit(5)
        )
        res_journals = await db.execute(stmt_journals)
        recent_journals = res_journals.scalars().all()
        
        # Extract user's recent moods
        user_moods = [
            j.mood_selected.value if hasattr(j.mood_selected, 'value') else str(j.mood_selected).lower()
            for j in recent_journals
        ]
        
        # Extract user's journal words
        user_journal_words = set()
        for j in recent_journals:
            try:
                dec_text = decrypt_string(j.entry_text)
                if dec_text:
                    words = re.findall(r'\b[a-zA-Z]{3,15}\b', dec_text.lower())
                    user_journal_words.update(words)
            except Exception:
                pass
                
        # Fetch user's recent check-ins for distress scoring
        stmt_checkins = (
            select(CheckIn)
            .where(CheckIn.user_id == current_user.id)
            .order_by(desc(CheckIn.created_at))
            .limit(5)
        )
        res_checkins = await db.execute(stmt_checkins)
        recent_checkins = res_checkins.scalars().all()
        avg_checkin_score = sum(c.score for c in recent_checkins) / len(recent_checkins) if recent_checkins else 0
        
        user_role = current_user.student_role.lower() if current_user.student_role else None
        
        # Score stories
        scored_stories = []
        for story in all_stories:
            score = 0.0
            
            # A. student_role matching
            if user_role:
                story_theme = story.theme.lower() if story.theme else ""
                story_excerpt = story.excerpt.lower() if story.excerpt else ""
                if user_role in story_theme or user_role in story_excerpt:
                    score += 5.0
                    
                role_mappings = {
                    "burnout": ["exhaust", "tired", "burnout", "overwhelmed", "drain", "sleep", "pressure"],
                    "exam season": ["exam", "study", "midterm", "test", "grade", "fail", "stress", "pressure", "anxious"],
                    "placement prep": ["interview", "job", "career", "resume", "intern", "prep", "future", "placement"],
                    "relationship stress": ["breakup", "fight", "friend", "relationship", "love", "lonely", "heartbroken", "argument"],
                    "identity & belonging": ["identity", "belong", "fit in", "imposter", "lonely", "who am i", "diverse", "accept"],
                    "first-year": ["transition", "dorm", "new", "freshman", "campus", "home", "adjust", "lost"]
                }
                if user_role in role_mappings:
                    if any(word in story_theme or word in story_excerpt for word in role_mappings[user_role]):
                        score += 3.0
                        
            # B. Mood matching
            story_mood = story.mood.lower() if story.mood else ""
            for mood in user_moods:
                if mood == story_mood:
                    score += 2.0
                    
            # C. Checkin distress score matching
            if avg_checkin_score >= 3:
                if story_mood in ["sad", "anxious", "overwhelmed", "numb"]:
                    score += 3.0
                elif story_mood in ["hopeful", "grateful", "calm"]:
                    score += 1.0
                    
            # D. Journal word overlap
            if user_journal_words:
                story_text = f"{(story.theme or '')} {(story.resonance_hook or '')} {story.excerpt}".lower()
                story_words = set(re.findall(r'\b[a-zA-Z]{3,15}\b', story_text))
                overlap = user_journal_words.intersection(story_words)
                score += min(len(overlap) * 0.5, 4.0)
                
            # Random jitter to keep feed dynamic
            score += random.uniform(0, 0.5)
            
            scored_stories.append((story, score))
            
        # Sort by score descending
        scored_stories.sort(key=lambda x: x[1], reverse=True)
        
        # Partition into relevance vs wildcard pools
        threshold = 2.0
        relevance_pool = [item[0] for item in scored_stories if item[1] >= threshold]
        wildcard_pool = [item[0] for item in scored_stories if item[1] < threshold]
        
        # Fallback if relevance pool is too small: partition by median score
        if len(relevance_pool) < len(scored_stories) // 2:
            median_idx = len(scored_stories) // 2
            relevance_pool = [item[0] for item in scored_stories[:median_idx]]
            wildcard_pool = [item[0] for item in scored_stories[median_idx:]]
            
        # Blend: up to 7 relevance, 3 wildcards
        selected_relevance = random.sample(relevance_pool, min(len(relevance_pool), 7))
        selected_wildcard = random.sample(wildcard_pool, min(len(wildcard_pool), 3))
        
        blended = selected_relevance + selected_wildcard
        
        # If we need more to reach 10 (or up to total available)
        remaining_needed = min(10, len(all_stories)) - len(blended)
        if remaining_needed > 0:
            already_selected_ids = {s.story_id for s in blended}
            candidates = [s for s in all_stories if s.story_id not in already_selected_ids]
            blended += random.sample(candidates, min(len(candidates), remaining_needed))
            
        # Shuffle final blended list to keep order anti-addictive and mixed
        random.shuffle(blended)
        
        return [
            {
                "story_id": str(story.story_id),
                "author_anon_id": story.author_anon_id,
                "mood": story.mood,
                "excerpt": story.excerpt,
                "resonance_count": story.resonance_count,
                "published_at": story.published_at,
                "theme": story.theme,
                "resonance_hook": story.resonance_hook
            }
            for story in blended[:10]  # Cap at exactly 10 items
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
    - Returns a curated, non-cliché 18-word response
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
            "message": "Your resonance has been shared anonymously",
            "resonance_response": random.choice(RESONANCE_RESPONSES)
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
            "created_at": story.created_at,
            "theme": story.theme,
            "resonance_hook": story.resonance_hook
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
