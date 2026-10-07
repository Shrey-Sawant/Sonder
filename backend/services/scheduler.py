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
    generator = get_insight_generator()
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    # Phase 1 (short-lived session): gather everything needed up front so the
    # database connection is not held open across the slow AI generation calls.
    async with SessionLocal() as db:
        try:
            students = (
                await db.execute(select(User).where(User.role == "student"))
            ).scalars().all()
            student_ids = [student.user_id for student in students]
            if not student_ids:
                print("[SCHEDULER] No students found; nothing to generate.")
                return

            existing_user_ids = set(
                (
                    await db.execute(
                        select(WeeklyInsight.user_id).where(
                            WeeklyInsight.user_id.in_(student_ids),
                            WeeklyInsight.week_start == week_start,
                        )
                    )
                ).scalars().all()
            )

            entries = (
                await db.execute(
                    select(JournalEntry).where(
                        JournalEntry.user_id.in_(student_ids),
                        JournalEntry.created_at >= thirty_days_ago,
                    )
                )
            ).scalars().all()
        except Exception as e:
            await db.rollback()
            print(f"[SCHEDULER] Error loading data for weekly insights: {e}")
            return

    entries_by_user: dict = {}
    for entry in entries:
        entries_by_user.setdefault(entry.user_id, []).append(entry)

    # Phase 2 (no DB session held): generate insight content.
    cards = []
    for student in students:
        if student.user_id in existing_user_ids:
            continue

        student_entries = entries_by_user.get(student.user_id, [])
        if len(student_entries) < 3:
            # Need at least 3 entries to generate meaningful insights
            continue

        try:
            insights_data = await generator.generate_weekly_insights(
                moods=[entry.mood_selected.value for entry in student_entries],
                timestamps=[entry.created_at for entry in student_entries],
                categories=[entry.prompt_category.value for entry in student_entries],
            )
        except Exception as se:
            print(f"[SCHEDULER] Failed generating weekly insight for user {student.user_id}: {se}")
            continue

        if not insights_data:
            continue

        cards.append(
            WeeklyInsight(
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
                generated_at=datetime.utcnow(),
            )
        )

    if not cards:
        print("[SCHEDULER] Weekly insights generation completed; no new insights to store.")
        return

    # Phase 3 (short-lived session): persist all generated cards atomically.
    async with SessionLocal() as db:
        try:
            db.add_all(cards)
            await db.commit()
            print(f"[SCHEDULER] Weekly insights generation completed. Stored {len(cards)} insights.")
        except Exception as e:
            await db.rollback()
            print(f"[SCHEDULER] Error storing weekly insights: {e}")


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
