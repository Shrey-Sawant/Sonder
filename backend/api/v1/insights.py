"""
Weekly Insights API v1 - Emotional pattern analysis and recommendations (Async version)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime, timedelta, date
from typing import List, Optional
import uuid

from db.session import get_db
from api.deps import get_current_user
from models.user import User
from models.weekly_insight import WeeklyInsight
from models.journal_entry import JournalEntry
from services.insight_generator import get_insight_generator

from pydantic import BaseModel

router = APIRouter(prefix="/insights", tags=["insights"])


# ===== SCHEMAS =====

class WeeklyInsightResponse(BaseModel):
    insight_id: str
    observation: str
    reframe: str
    micro_action: str
    week_start: date
    viewed: bool
    generated_at: datetime
    
    class Config:
        from_attributes = True


# ===== ENDPOINTS =====

@router.get("/weekly", response_model=Optional[WeeklyInsightResponse])
async def get_latest_weekly_insight(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the latest weekly insight for the user
    Marks as viewed when accessed
    """
    try:
        stmt = (
            select(WeeklyInsight)
            .where(WeeklyInsight.user_id == current_user.user_id)
            .order_by(desc(WeeklyInsight.week_start))
        )
        res = await db.execute(stmt)
        insight = res.scalars().first()
        
        if not insight:
            return None
        
        # Mark as viewed
        if not insight.viewed:
            insight.viewed = True
            insight.viewed_at = datetime.utcnow()
            await db.commit()
        
        return {
            "insight_id": str(insight.insight_id),
            "observation": insight.observation,
            "reframe": insight.reframe,
            "micro_action": insight.micro_action,
            "week_start": insight.week_start,
            "viewed": insight.viewed,
            "generated_at": insight.generated_at
        }
    
    except Exception as e:
        print(f"Error fetching latest insight: {e}")
        raise HTTPException(status_code=500, detail="Error fetching insight")


@router.get("/weekly/history", response_model=List[WeeklyInsightResponse])
async def get_insight_history(
    limit: int = 12,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get past weekly insights (paginated)"""
    try:
        stmt = (
            select(WeeklyInsight)
            .where(WeeklyInsight.user_id == current_user.user_id)
            .order_by(desc(WeeklyInsight.week_start))
            .limit(limit)
            .offset(offset)
        )
        res = await db.execute(stmt)
        insights = res.scalars().all()
        
        return [
            {
                "insight_id": str(insight.insight_id),
                "observation": insight.observation,
                "reframe": insight.reframe,
                "micro_action": insight.micro_action,
                "week_start": insight.week_start,
                "viewed": insight.viewed,
                "generated_at": insight.generated_at
            }
            for insight in insights
        ]
    
    except Exception as e:
        print(f"Error fetching insight history: {e}")
        raise HTTPException(status_code=500, detail="Error fetching history")


@router.post("/weekly/generate")
async def generate_weekly_insight(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger weekly insight generation
    Analyzes last 30 days of journal entries
    Detects patterns and generates AI insights
    """
    try:
        # Calculate week range
        today = datetime.utcnow().date()
        week_start = today - timedelta(days=today.weekday())
        
        # Check if insight already exists for this week
        stmt = select(WeeklyInsight).where(
            WeeklyInsight.user_id == current_user.user_id,
            WeeklyInsight.week_start == week_start
        )
        res = await db.execute(stmt)
        existing = res.scalars().first()
        
        if existing:
            return {
                "success": False,
                "message": "Insight already generated for this week",
                "insight_id": str(existing.insight_id)
            }
        
        # Get entries from last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        stmt_entries = (
            select(JournalEntry)
            .where(
                JournalEntry.user_id == current_user.user_id,
                JournalEntry.created_at >= thirty_days_ago
            )
        )
        res_entries = await db.execute(stmt_entries)
        entries = res_entries.scalars().all()
        
        if len(entries) < 3:
            return {
                "success": False,
                "message": "Need at least 3 entries in the past 30 days for insight generation"
            }
        
        # Extract data
        moods = [entry.mood_selected.value for entry in entries]
        timestamps = [entry.created_at for entry in entries]
        categories = [entry.prompt_category.value for entry in entries]
        
        # Generate insights
        generator = get_insight_generator()
        insights_data = await generator.generate_weekly_insights(
            moods=moods,
            timestamps=timestamps,
            categories=categories
        )
        
        if not insights_data:
            return {
                "success": False,
                "message": "Error generating insights"
            }
        
        # Store insight
        insight = WeeklyInsight(
            insight_id=uuid.uuid4(),
            user_id=current_user.user_id,
            week_start=week_start,
            observation=insights_data["observation"],
            reframe=insights_data["reframe"],
            micro_action=insights_data["micro_action"],
            mood_frequency_data=insights_data.get("mood_frequency_data"),
            trigger_categories=insights_data.get("trigger_categories"),
            time_of_day_pattern=insights_data.get("time_of_day_pattern"),
            positive_streaks=insights_data.get("positive_streaks"),
            generated_at=datetime.utcnow()
        )
        
        db.add(insight)
        await db.commit()
        
        return {
            "success": True,
            "insight_id": str(insight.insight_id),
            "insight": {
                "observation": insight.observation,
                "reframe": insight.reframe,
                "micro_action": insight.micro_action,
                "week_start": week_start
            }
        }
    
    except Exception as e:
        await db.rollback()
        print(f"Error generating insight: {e}")
        raise HTTPException(status_code=500, detail="Error generating insight")
