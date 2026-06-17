"""
Background Scheduler Service - Manages weekly insight generation and post-session mood check-ins
Uses APScheduler's AsyncIOScheduler to align with FastAPI's async execution loop
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import uuid
import json

from db.session import SessionLocal
from models.user import User
from models.journal_entry import JournalEntry
from models.weekly_insight import WeeklyInsight
from models.counselling_session import CounsellingSession, SessionStatusEnum
from models.notification import Notification
from services.insight_generator import get_insight_generator
from sqlalchemy.future import select
from sqlalchemy import desc

# Initialize AsyncIOScheduler
scheduler = AsyncIOScheduler()


async def run_weekly_insights_generation():
    """
    Weekly digest generation - Runs every Sunday at 8 PM local time
    Generates weekly insights cards for all student users
    """
    print("[SCHEDULER] Starting weekly insights generation...")
    async with SessionLocal() as db:
        try:
            # Fetch all student users
            stmt_students = select(User).where(User.role == "student")
            res_students = await db.execute(stmt_students)
            students = res_students.scalars().all()
            
            generator = get_insight_generator()
            today = datetime.utcnow().date()
            week_start = today - timedelta(days=today.weekday())
            
            for student in students:
                try:
                    # Check if weekly insight already exists
                    stmt_exist = select(WeeklyInsight).where(
                        WeeklyInsight.user_id == student.user_id,
                        WeeklyInsight.week_start == week_start
                    )
                    res_exist = await db.execute(stmt_exist)
                    if res_exist.scalars().first():
                        continue
                        
                    # Fetch student's journal entries from last 30 days
                    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
                    stmt_entries = (
                        select(JournalEntry)
                        .where(
                            JournalEntry.user_id == student.user_id,
                            JournalEntry.created_at >= thirty_days_ago
                        )
                    )
                    res_entries = await db.execute(stmt_entries)
                    entries = res_entries.scalars().all()
                    
                    if len(entries) < 3:
                        # Need at least 3 entries to generate meaningful insights
                        continue
                        
                    moods = [entry.mood_selected.value for entry in entries]
                    timestamps = [entry.created_at for entry in entries]
                    categories = [entry.prompt_category.value for entry in entries]
                    
                    insights_data = await generator.generate_weekly_insights(
                        moods=moods,
                        timestamps=timestamps,
                        categories=categories
                    )
                    
                    if insights_data:
                        weekly_card = WeeklyInsight(
                            insight_id=uuid.uuid4(),
                            user_id=student.user_id,
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
                        db.add(weekly_card)
                        
                except Exception as se:
                    print(f"[SCHEDULER] Failed generating weekly insight for user {student.user_id}: {se}")
                    
            await db.commit()
            print("[SCHEDULER] Weekly insights generation completed successfully.")
            
        except Exception as e:
            await db.rollback()
            print(f"[SCHEDULER] Error in weekly insights task: {e}")


async def send_post_session_mood_check(session_id_str: str):
    """
    Task to auto-send a mood check-in prompt to student 30 min after session ends
    """
    print(f"[SCHEDULER] Running post-session mood check for session: {session_id_str}")
    async with SessionLocal() as db:
        try:
            sess_uuid = uuid.UUID(session_id_str)
            stmt = select(CounsellingSession).where(CounsellingSession.session_id == sess_uuid)
            res = await db.execute(stmt)
            session = res.scalars().first()
            
            if not session:
                print(f"[SCHEDULER] Session {session_id_str} not found.")
                return
                
            if session.status == SessionStatusEnum.COMPLETED and not session.mood_check_sent:
                # Retrieve student's integer id to match Notification table requirement
                stmt_student = select(User).where(User.user_id == session.student_user_id)
                res_student = await db.execute(stmt_student)
                student = res_student.scalars().first()
                
                if student:
                    # Insert check-in notification for student
                    msg = "It's been 30 minutes since your session. How is your mood doing? Tap here to log a journal entry."
                    notification = Notification(
                        user_id=student.id,
                        message=msg,
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(notification)
                    
                    # Update session status
                    session.mood_check_sent = True
                    await db.commit()
                    print(f"[SCHEDULER] Mood check-in notification sent to student (id: {student.id})")
                else:
                    print(f"[SCHEDULER] Student with user_id {session.student_user_id} not found.")
            else:
                print(f"[SCHEDULER] Session status is {session.status.value} or check-in already sent.")
                
        except Exception as e:
            await db.rollback()
            print(f"[SCHEDULER] Error sending post-session check-in: {e}")


def start_scheduler():
    """
    Configure and start the background scheduler
    """
    if not scheduler.running:
        scheduler.start()
        # Schedule the weekly insight task for every Sunday at 8:00 PM local time (20:00)
        scheduler.add_job(
            run_weekly_insights_generation,
            trigger=CronTrigger(day_of_week="sun", hour=20, minute=0),
            id="weekly_insights_generation",
            replace_existing=True
        )
        print("[SCHEDULER] Background scheduler started and Sunday 8PM cron scheduled.")
