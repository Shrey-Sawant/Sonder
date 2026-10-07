from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select
from datetime import date, time, datetime, timezone
from uuid import uuid4
import logging

# Internal project imports - Ensure these paths match your structure
from db.session import get_db
from models.schedule_request import ScheduleRequest
from models.user import User
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from api.deps import get_current_user
from models.notification import Notification
from utils.email import send_email

router = APIRouter()

logger = logging.getLogger(__name__)


def _normalize_scheduled_time(value: datetime) -> datetime:
    """Coerce a possibly timezone-aware datetime to naive UTC for the column."""
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


# --- Routes ---

@router.get("/busy-slots")
async def get_busy_slots(
    counsellor_id: int,
    selected_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a list of booked hours (HH:00) for a specific date."""
    start_of_day = datetime.combine(selected_date, time.min)
    end_of_day = datetime.combine(selected_date, time.max)

    stmt = select(ScheduleRequest).where(
        and_(
            ScheduleRequest.counsellor_id == counsellor_id,
            ScheduleRequest.scheduled_time >= start_of_day,
            ScheduleRequest.scheduled_time <= end_of_day,
            ScheduleRequest.status.in_(["pending", "accepted"])
        )
    )
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    busy_slots = [b.scheduled_time.strftime("%H:00") for b in bookings]

    return busy_slots


@router.post("/", response_model=ScheduleRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_request(
    request: ScheduleRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure variables are strictly Python integers
    try:
        c_id = int(request.counsellor_id)
        s_id = int(current_user.id)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=422, detail="IDs must be valid integers")

    # 0. Role + input validation (before touching the database).
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can book appointments")

    scheduled_time = _normalize_scheduled_time(request.scheduled_time)
    if scheduled_time <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Appointment time must be in the future")

    # 0b. The target must be a real, approved counsellor -- not an arbitrary id.
    counsellor_res = await db.execute(
        select(User).where(
            User.id == c_id,
            User.role == "counsellor",
            User.is_verified.is_(True),
            User.is_approved.is_(True),
        )
    )
    if not counsellor_res.scalars().first():
        raise HTTPException(status_code=404, detail="Counsellor not found or not approved")

    # 1. Conflict Check
    conflict_check = await db.execute(
        select(ScheduleRequest).where(
            and_(
                ScheduleRequest.counsellor_id == c_id,
                ScheduleRequest.scheduled_time == scheduled_time,
                ScheduleRequest.status.in_(["pending", "accepted"])
            )
        )
    )
    
    conflict = conflict_check.scalars().first()
    if conflict:
        raise HTTPException(status_code=400, detail="This time slot is already booked.")

    # 2. Create a meeting room link and save the entry
    meeting_url = f"https://meet.jit.si/sonder-appointment-{uuid4().hex}"
    new_request = ScheduleRequest(
        student_id=s_id,
        counsellor_id=c_id,
        scheduled_time=scheduled_time,
        video_meeting_url=meeting_url,
        status="pending",
    )
    db.add(new_request)

    try:
        await db.commit()
        await db.refresh(new_request)
    except Exception as e:
        await db.rollback()
        logger.error("Failed to save schedule request: %s", e)
        raise HTTPException(status_code=500, detail="Could not save booking")

    # 3. Notification for Counselor (optional)
    try:
        notification = Notification(
            user_id=c_id,
            message=f"New appointment request for {scheduled_time.strftime('%Y-%m-%d %H:%M')}.",
        )
        db.add(notification)
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning("Schedule notification insert failed: %s", e)

    # 4. Send appointment reminder emails for request creation
    try:
        student_res = await db.execute(select(User).where(User.id == s_id))
        counsellor_res = await db.execute(select(User).where(User.id == c_id))
        student = student_res.scalars().first()
        counsellor = counsellor_res.scalars().first()

        if student and counsellor:
            template_params = {
                "to_email": student.email,
                "reply_to": student.email,
                "email": student.email,
                "to": student.email,
                "to_name": student.username,
                "recipient_name": student.username,
                "appointment_time": scheduled_time.strftime('%Y-%m-%d %H:%M'),
                "counsellor_name": counsellor.username,
                "student_name": student.username,
                "meeting_url": meeting_url,
                "meeting_link": meeting_url,
                "status": "pending",
                "subject": "Sonder Appointment Request Submitted",
                "message": f"Your appointment request for {scheduled_time.strftime('%Y-%m-%d %H:%M')} has been created. The counselor will confirm it soon.",
            }
            background_tasks.add_task(send_email, student.email, "Sonder Appointment Request", template_params)

            counsellor_template_params = {
                "to_email": counsellor.email,
                "reply_to": counsellor.email,
                "email": counsellor.email,
                "to": counsellor.email,
                "to_name": counsellor.username,
                "recipient_name": counsellor.username,
                "appointment_time": scheduled_time.strftime('%Y-%m-%d %H:%M'),
                "counsellor_name": counsellor.username,
                "student_name": student.username,
                "meeting_url": meeting_url,
                "meeting_link": meeting_url,
                "status": "pending",
                "subject": "New Sonder Appointment Request",
                "message": f"A new appointment request from {student.username} is awaiting your review.",
            }
            background_tasks.add_task(send_email, counsellor.email, "New Sonder Appointment Request", counsellor_template_params)
    except Exception as e:
        logger.warning("Schedule email scheduling failed: %s", e)

    try:
        await db.refresh(new_request)
        
        # Load names for response
        s_name_res = await db.execute(select(User.username).where(User.id == s_id))
        c_name_res = await db.execute(select(User.username).where(User.id == c_id))
        new_request.student_name = s_name_res.scalar_one_or_none()
        new_request.counsellor_name = c_name_res.scalar_one_or_none()
        
        return new_request
    except Exception as e:
        await db.rollback()
        logger.error("Failed to build schedule response: %s", e)
        raise HTTPException(status_code=500, detail="Could not save booking")


@router.get("/", response_model=list[ScheduleRequestResponse])
async def get_schedule_requests(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy.orm import aliased
    StudentUser = aliased(User)
    CounsellorUser = aliased(User)

    # Filters based on role
    if current_user.role == "student":
        stmt = (
            select(
                ScheduleRequest,
                StudentUser.username.label("student_name"),
                CounsellorUser.username.label("counsellor_name")
            )
            .outerjoin(StudentUser, ScheduleRequest.student_id == StudentUser.id)
            .outerjoin(CounsellorUser, ScheduleRequest.counsellor_id == CounsellorUser.id)
            .where(ScheduleRequest.student_id == current_user.id)
        )
    elif current_user.role == "counsellor":
        stmt = (
            select(
                ScheduleRequest,
                StudentUser.username.label("student_name"),
                CounsellorUser.username.label("counsellor_name")
            )
            .outerjoin(StudentUser, ScheduleRequest.student_id == StudentUser.id)
            .outerjoin(CounsellorUser, ScheduleRequest.counsellor_id == CounsellorUser.id)
            .where(ScheduleRequest.counsellor_id == current_user.id)
        )
    else:
        stmt = (
            select(
                ScheduleRequest,
                StudentUser.username.label("student_name"),
                CounsellorUser.username.label("counsellor_name")
            )
            .outerjoin(StudentUser, ScheduleRequest.student_id == StudentUser.id)
            .outerjoin(CounsellorUser, ScheduleRequest.counsellor_id == CounsellorUser.id)
        )

    result = await db.execute(stmt)
    items = []
    for row in result.all():
        req = row[0]
        req.student_name = row[1]
        req.counsellor_name = row[2]
        items.append(req)
        
    return items


@router.put("/{request_id}", response_model=ScheduleRequestResponse)
async def update_schedule_status(
    request_id: int,
    status: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Authorization Check
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")

    allowed_statuses = {
        "pending",
        "accepted",
        "declined",
        "rejected",
        "completed",
        "cancelled",
    }
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid appointment status")

    result = await db.execute(
        select(ScheduleRequest).where(ScheduleRequest.id == request_id)
    )
    request_obj = result.scalars().first()
    
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")

    # A counsellor may only act on their own appointments; admins may act on any.
    if current_user.role != "admin" and request_obj.counsellor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this appointment",
        )

    old_status = request_obj.status
    request_obj.status = status

    try:
        await db.commit()
        await db.refresh(request_obj)
    except Exception as e:
        await db.rollback()
        logger.error("Failed to update schedule request %s: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Update failed")

    # Create notification for student
    if status in ["accepted", "declined", "rejected"]:
        new_notification = Notification(
            user_id=request_obj.student_id,
            message=f"Your appointment for {request_obj.scheduled_time.strftime('%Y-%m-%d %H:%M')} has been {status}.",
        )
        db.add(new_notification)
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.warning("Status notification insert failed: %s", e)

        # Send confirmation / reminder emails once status changes
        try:
            student_res = await db.execute(select(User).where(User.id == request_obj.student_id))
            counsellor_res = await db.execute(select(User).where(User.id == request_obj.counsellor_id))
            student = student_res.scalars().first()
            counsellor = counsellor_res.scalars().first()

            if student and counsellor:
                appointment_time = request_obj.scheduled_time.strftime('%Y-%m-%d %H:%M')
                template_params = {
                    "to_email": student.email,
                    "reply_to": student.email,
                    "email": student.email,
                    "to": student.email,
                    "to_name": student.username,
                    "recipient_name": student.username,
                    "appointment_time": appointment_time,
                    "counsellor_name": counsellor.username,
                    "student_name": student.username,
                    "meeting_url": request_obj.video_meeting_url,
                    "meeting_link": request_obj.video_meeting_url,
                    "status": status,
                    "subject": f"Sonder Appointment {status.title()}",
                    "message": f"Your appointment on {appointment_time} has been {status}.",
                }
                background_tasks.add_task(send_email, student.email, f"Sonder Appointment {status.title()}", template_params)

                counsellor_template_params = {
                    "to_email": counsellor.email,
                    "reply_to": counsellor.email,
                    "email": counsellor.email,
                    "to": counsellor.email,
                    "to_name": counsellor.username,
                    "recipient_name": counsellor.username,
                    "appointment_time": appointment_time,
                    "counsellor_name": counsellor.username,
                    "student_name": student.username,
                    "meeting_url": request_obj.video_meeting_url,
                    "meeting_link": request_obj.video_meeting_url,
                    "status": status,
                    "subject": f"Appointment {status.title()} Notification",
                    "message": f"Appointment for {student.username} on {appointment_time} has been {status}.",
                }
                background_tasks.add_task(send_email, counsellor.email, f"Appointment {status.title()} Notification", counsellor_template_params)
        except Exception as e:
            logger.warning("Status email scheduling failed: %s", e)

    try:
        await db.refresh(request_obj)
        
        # Load names for response
        s_name_res = await db.execute(select(User.username).where(User.id == request_obj.student_id))
        c_name_res = await db.execute(select(User.username).where(User.id == request_obj.counsellor_id))
        request_obj.student_name = s_name_res.scalar_one_or_none()
        request_obj.counsellor_name = c_name_res.scalar_one_or_none()
        
        return request_obj
    except Exception as e:
        await db.rollback()
        logger.error("Failed to build update response for schedule request %s: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Update failed")
