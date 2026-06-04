from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from typing import List
from db.session import get_db
from models.journal import JournalEntry
from schemas.journal import JournalEntryCreate, JournalEntryResponse
from api.v1.auth import get_current_user
from models.user import User
from groq import Groq
import os
import json

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

router = APIRouter()

def get_sentiment(text: str):
    prompt = f"""Analyze the sentiment of the following journal entry. 
Respond ONLY with a valid JSON object containing exactly these two keys:
- "score": a float between -1.0 (extremely negative) and 1.0 (extremely positive)
- "label": a single emoji string, must be exactly one of: 😄, 🙂, 😐, 😔

Journal entry:
{text}
"""
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        return float(data.get("score", 0.0)), data.get("label", "😐")
    except Exception:
        # Fallback if API fails
        return 0.0, "😐"

@router.post("/entry", response_model=JournalEntryResponse)
async def create_journal_entry(
    entry: JournalEntryCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    score, label = get_sentiment(entry.text)
    
    new_entry = JournalEntry(
        user_id=current_user.id,
        text=entry.text,
        sentiment_score=score,
        sentiment_label=label
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)
    return new_entry

@router.get("/history", response_model=List[JournalEntryResponse])
async def get_journal_history(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Fetch last 30 entries
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.user_id == current_user.id)
        .order_by(desc(JournalEntry.timestamp))
        .limit(30)
    )
    entries = result.scalars().all()
    # Reverse them to show chronological order if needed, but returning desc is fine for list.
    return entries
