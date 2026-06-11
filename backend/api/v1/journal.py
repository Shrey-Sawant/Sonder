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
    
    # Auto flag high-risk sentiment
    is_flagged = False
    flag_reason = None
    if score < -0.5:
        is_flagged = True
        flag_reason = "High Risk Sentiment"
        
    new_entry = JournalEntry(
        user_id=current_user.id,
        text=entry.text,
        sentiment_score=score,
        sentiment_label=label,
        is_flagged=is_flagged,
        flag_reason=flag_reason
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)
    return new_entry

@router.get("/flagged")
async def get_flagged_journals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        select(JournalEntry, User.username)
        .join(User, JournalEntry.user_id == User.id)
        .where(JournalEntry.is_flagged == True)
        .order_by(desc(JournalEntry.timestamp))
    )
    res = await db.execute(stmt)
    flagged = []
    for row in res.all():
        je, username = row
        flagged.append({
            "id": je.id,
            "student": username,
            "text": je.text,
            "timestamp": je.timestamp.isoformat(),
            "reason": je.flag_reason or "High Risk Sentiment"
        })
    return flagged

@router.put("/flagged/{journal_id}/dismiss")
async def dismiss_journal_flag(
    journal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    res = await db.execute(select(JournalEntry).where(JournalEntry.id == journal_id))
    je = res.scalars().first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    je.is_flagged = False
    await db.commit()
    return {"message": "Flag dismissed"}

@router.delete("/{journal_id}")
async def delete_journal_entry(
    journal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(JournalEntry).where(JournalEntry.id == journal_id))
    je = res.scalars().first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    if current_user.role != "admin" and je.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(je)
    await db.commit()
    return {"message": "Journal entry deleted"}

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
    return entries
