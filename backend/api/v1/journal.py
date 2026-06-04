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
import torch

try:
    from transformers import pipeline
    # Load sentiment analysis pipeline. Using a specific lightweight model for speed if needed, 
    # but the requested distilbert-base-uncased-finetuned-sst-2-english is good.
    device = 0 if torch.cuda.is_available() else -1
    sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english", device=device)
except ImportError:
    sentiment_pipeline = None
    from textblob import TextBlob

router = APIRouter()

def get_sentiment(text: str):
    if sentiment_pipeline:
        try:
            result = sentiment_pipeline(text[:512])[0] # Limit to 512 tokens to avoid errors
            # Output format: {'label': 'POSITIVE', 'score': 0.99}
            score = result['score'] if result['label'] == 'POSITIVE' else -result['score']
            
            # Map to our badges: 😔 / 😐 / 🙂 / 😄
            if score > 0.5:
                label = "😄"
            elif score > 0:
                label = "🙂"
            elif score > -0.5:
                label = "😐"
            else:
                label = "😔"
                
            return score, label
        except Exception:
            pass # Fallback if pipeline fails
            
    # Fallback to TextBlob
    blob = TextBlob(text)
    score = blob.sentiment.polarity
    if score > 0.5:
        label = "😄"
    elif score > 0:
        label = "🙂"
    elif score > -0.5:
        label = "😐"
    else:
        label = "😔"
    return score, label

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
