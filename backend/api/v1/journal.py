"""
Journal API v1 - Mood tracking and reflective entry management (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional
import uuid

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.journal_entry import JournalEntry, MoodEnum, PromptCategoryEnum
from models.shared_story import SharedStory
from core.encryption import encrypt_string, decrypt_string
from services.mood_companion import get_mood_companion
from services.crisis_detector import get_crisis_detector
from models.crisis_event import CrisisEvent
from services.content_moderator import get_content_moderator
from services.story_engine import get_story_engine

from pydantic import BaseModel, Field

router = APIRouter()


# ===== SCHEMAS =====

class JournalEntryCreate(BaseModel):
    mood_selected: MoodEnum
    prompt_category: PromptCategoryEnum
    entry_text: str = Field(..., min_length=50)  # Minimum 50 chars


class JournalEntryShareRequest(BaseModel):
    entry_id: str
    share_anonymously: bool = True


class JournalEntryResponse(BaseModel):
    entry_id: str
    mood_selected: str
    prompt_category: str
    entry_text: str
    ai_reflection: Optional[str]
    shared_anonymously: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PromptResponse(BaseModel):
    category: str
    text: str


# ===== PROMPTS BY CATEGORY =====

PROMPTS = {
    PromptCategoryEnum.ACADEMIC: [
        "What's one thing weighing on you about this semester?",
        "When did you feel most stressed about school this week?",
        "What's one academic goal that excites you right now?",
        "Describe a time this week when you felt unprepared.",
    ],
    PromptCategoryEnum.SOCIAL: [
        "Did you feel seen by someone today, or unseen?",
        "Who made you feel valued this week?",
        "What's one conversation you wish you'd had?",
        "How did you show up for someone today?",
    ],
    PromptCategoryEnum.IDENTITY: [
        "What version of yourself showed up today?",
        "Where do you feel like yourself, and where don't you?",
        "What part of your identity felt challenged this week?",
        "Who do you want to be becoming?",
    ],
    PromptCategoryEnum.GENERAL: [
        "What do you wish you could say out loud right now?",
        "What brought you peace this week?",
        "If you could change one thing about today, what would it be?",
        "What's something you're grateful for, even if it's small?",
    ]
}


# ===== ENDPOINTS =====

@router.post("/entries", response_model=dict)
async def create_journal_entry(
    entry_data: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new journal entry
    - Mood wheel selection
    - Prompt category
    - Free-text entry (min 50 chars)
    - Generates AI reflection
    - Runs crisis detection
    """
    try:
        # Encrypt entry text
        encrypted_entry = encrypt_string(entry_data.entry_text)
        
        # Create entry
        entry = JournalEntry(
            entry_id=uuid.uuid4(),
            user_id=current_user.user_id,
            anon_id=current_user.anon_id,
            mood_selected=entry_data.mood_selected,
            prompt_category=entry_data.prompt_category,
            entry_text=encrypted_entry,
            created_at=datetime.utcnow()
        )
        
        db.add(entry)
        await db.flush()
        
        # Generate AI reflection
        companion = get_mood_companion()
        ai_reflection = await companion.generate_reflection(
            entry_data.mood_selected.value,
            entry_data.entry_text
        )
        
        if ai_reflection:
            entry.ai_reflection = ai_reflection
        
        # Crisis detection
        detector = get_crisis_detector()
        crisis_result = await detector.assess_risk(
            entry_data.entry_text,
            source_type="journal"
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
                source="journal",
                source_id=entry.entry_id,
                risk_level=crisis_result["risk_level"].lower(),
                signal_text=encrypt_string(crisis_result["signal"]),
                ai_reasoning=crisis_result.get("signal", ""),
                triggered_at=datetime.utcnow()
            )
            db.add(crisis_event)
        
        await db.commit()
        
        return {
            "entry_id": str(entry.entry_id),
            "mood_selected": entry.mood_selected.value,
            "prompt_category": entry.prompt_category.value,
            "ai_reflection": ai_reflection,
            "created_at": entry.created_at,
            "crisis_detected": crisis_detected,
            "crisis_level": crisis_level
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error creating journal entry: {e}")
        raise HTTPException(status_code=500, detail="Error creating entry")


@router.get("/entries", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's journal entries (paginated, most recent first)"""
    try:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.user_id == current_user.user_id)
            .order_by(desc(JournalEntry.created_at))
            .limit(limit)
            .offset(offset)
        )
        res = await db.execute(stmt)
        entries = res.scalars().all()
        
        result = []
        for entry in entries:
            result.append({
                "entry_id": str(entry.entry_id),
                "mood_selected": entry.mood_selected.value,
                "prompt_category": entry.prompt_category.value,
                "entry_text": decrypt_string(entry.entry_text) if entry.entry_text else "",
                "ai_reflection": entry.ai_reflection,
                "shared_anonymously": entry.shared_anonymously,
                "created_at": entry.created_at
            })
        
        return result
    
    except Exception as e:
        print(f"Error fetching entries: {e}")
        raise HTTPException(status_code=500, detail="Error fetching entries")


@router.get("/prompt")
async def get_daily_prompt():
    """Get a random prompt for the mood wheel"""
    import random
    categories = list(PROMPTS.keys())
    chosen_category = random.choice(categories)
    prompt = random.choice(PROMPTS[chosen_category])
    
    return {
        "category": chosen_category.value,
        "text": prompt
    }


@router.post("/share")
async def share_entry_anonymously(
    request: JournalEntryShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Share a journal entry anonymously to the story feed
    - AI content moderation check
    - Only excerpt stored (max 120 chars)
    - No identifiable info
    """
    try:
        # Get entry
        stmt = select(JournalEntry).where(
            JournalEntry.entry_id == uuid.UUID(request.entry_id),
            JournalEntry.user_id == current_user.user_id
        )
        res = await db.execute(stmt)
        entry = res.scalars().first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        if entry.shared_anonymously:
            raise HTTPException(status_code=400, detail="Entry already shared")
        
        # Decrypt entry for processing
        decrypted_text = decrypt_string(entry.entry_text)
        
        # Process through Story Engine 3-step pipeline
        story_engine = get_story_engine()
        engine_result = await story_engine.process_entry(decrypted_text)
        
        if not engine_result["is_safe"]:
            return {
                "success": False,
                "message": engine_result.get("rejection_message") or "This entry is a bit too personal to share — your words are safe with us."
            }
        
        # Create story storing the reformatted text in excerpt
        reformatted_text = engine_result.get("reformatted_text") or decrypted_text
        story = SharedStory(
            story_id=uuid.uuid4(),
            journal_entry_id=entry.entry_id,
            author_anon_id=current_user.anon_id,
            excerpt=reformatted_text,
            mood=engine_result.get("mood") or entry.mood_selected.value,
            theme=engine_result.get("theme"),
            resonance_hook=engine_result.get("resonance_hook"),
            moderated=True,
            published_at=datetime.utcnow()
        )
        
        entry.shared_anonymously = True
        
        db.add(story)
        await db.commit()
        
        return {
            "success": True,
            "story_id": str(story.story_id),
            "message": "Shared anonymously! Your story might help someone feel less alone."
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error sharing entry: {e}")
        raise HTTPException(status_code=500, detail="Error sharing entry")
