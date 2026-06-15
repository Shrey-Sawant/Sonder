from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select
from datetime import date, time, datetime
from uuid import uuid4

# Internal project imports - Ensure these paths match your structure
from db.session import get_db
from models.schedule_request import ScheduleRequest
from models.user import User
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from api.deps import get_current_user
from models.notification import Notification
from utils.email import send_email

# Internal project imports - Ensure these paths match your structure
from db.session import get_db
from models.schedule_request import ScheduleRequest
from models.user import User
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from api.deps import get_current_user
from models.notification import Notification
from utils.email import send_email

router = APIRouter()

# --- Routes ---

@router.get("/busy-slots")
async def get_busy_slots(
    counsellor_id: int,
    selected_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a list of booked hours (HH:00) for a specific date."""
    print(f"\n[DEBUG] GET /busy-slots")
    print(f"-> Params: counsellor_id={counsellor_id}, date={selected_date}")
    
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
    
    print(f"-> Found {len(busy_slots)} busy slots: {busy_slots}")
    return busy_slots


@router.post("/", response_model=ScheduleRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_request(
    request: ScheduleRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"\n[DEBUG] POST / (Create Schedule)")
    print(f"-> Incoming JSON: {request.dict()}")
    print(f"-> Authenticated User: ID={current_user.id}, Role={current_user.role}")

    # Ensure variables are strictly Python integers
    try:
        c_id = int(request.counsellor_id)
        s_id = int(current_user.id)
    except (ValueError, TypeError) as e:
        print(f"-> Error casting IDs: {e}")
        raise HTTPException(status_code=422, detail="IDs must be valid integers")

    # 1. Conflict Check
    print(f"-> Checking for conflicts at {request.scheduled_time}")
    conflict_check = await db.execute(
        select(ScheduleRequest).where(
            and_(
                ScheduleRequest.counsellor_id == c_id,
                ScheduleRequest.scheduled_time == request.scheduled_time,
                ScheduleRequest.status.in_(["pending", "accepted"])
            )
        )
    )
    
    conflict = conflict_check.scalars().first()
    if conflict:
        print(f"-> CONFLICT: Slot already taken by Request ID {conflict.id}")
        raise HTTPException(status_code=400, detail="This time slot is already booked.")

    # 2. Create a meeting room link and save the entry
    meeting_url = f"https://meet.jit.si/sonder-appointment-{uuid4().hex}"
    new_request = ScheduleRequest(
        student_id=s_id,
        counsellor_id=c_id,
        scheduled_time=request.scheduled_time,
        video_meeting_url=meeting_url,
        status="pending",
    )
    db.add(new_request)

    try:
        await db.commit()
        await db.refresh(new_request)
    except Exception as e:
        await db.rollback()
        print(f"-> DB ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not save booking")

    # 3. Notification for Counselor (optional)
    try:
        notification = Notification(
            user_id=c_id,
            message=f"New appointment request for {request.scheduled_time.strftime('%Y-%m-%d %H:%M')}.",
        )
        db.add(notification)
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"-> Notification insert failed, continuing without notification: {e}")

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
                "appointment_time": request.scheduled_time.strftime('%Y-%m-%d %H:%M'),
                "counsellor_name": counsellor.username,
                "student_name": student.username,
                "meeting_url": meeting_url,
                "meeting_link": meeting_url,
                "status": "pending",
                "subject": "Sonder Appointment Request Submitted",
                "message": f"Your appointment request for {request.scheduled_time.strftime('%Y-%m-%d %H:%M')} has been created. The counselor will confirm it soon.",
            }
            background_tasks.add_task(send_email, student.email, "Sonder Appointment Request", template_params)

            counsellor_template_params = {
                "to_email": counsellor.email,
                "reply_to": counsellor.email,
                "email": counsellor.email,
                "to": counsellor.email,
                "to_name": counsellor.username,
                "recipient_name": counsellor.username,
                "appointment_time": request.scheduled_time.strftime('%Y-%m-%d %H:%M'),
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
        print(f"-> Email task scheduling failed: {e}")

    try:
        await db.refresh(new_request)
        
        # Load names for response
        s_name_res = await db.execute(select(User.username).where(User.id == s_id))
        c_name_res = await db.execute(select(User.username).where(User.id == c_id))
        new_request.student_name = s_name_res.scalar_one_or_none()
        new_request.counsellor_name = c_name_res.scalar_one_or_none()
        
        print(f"-> SUCCESS: Created ScheduleRequest ID {new_request.id}")
        return new_request
    except Exception as e:
        await db.rollback()
        print(f"-> DB ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not save booking")


@router.get("/", response_model=list[ScheduleRequestResponse])
async def get_schedule_requests(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    print(f"\n[DEBUG] GET / (List Requests)")
    print(f"-> User {current_user.id} fetching requests as {current_user.role}")

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
        print("-> Admin/Other role: fetching all records")
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
        
    print(f"-> Returning {len(items)} records.")
    return items


@router.put("/{request_id}", response_model=ScheduleRequestResponse)
async def update_schedule_status(
    request_id: int,
    status: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"\n[DEBUG] PUT /{request_id}")
    print(f"-> Action: Status change to '{status}' by User {current_user.id}")

    # Authorization Check
    if current_user.role not in ["counsellor", "admin"]:
        print(f"-> Access Denied: User role '{current_user.role}' unauthorized.")
        raise HTTPException(status_code=403, detail="Not authorized to update status")

    result = await db.execute(
        select(ScheduleRequest).where(ScheduleRequest.id == request_id)
    )
    request_obj = result.scalars().first()
    
    if not request_obj:
        print(f"-> Error: Request {request_id} not found.")
        raise HTTPException(status_code=404, detail="Request not found")

    old_status = request_obj.status
    request_obj.status = status
    print(f"-> Updating status: {old_status} -> {status}")

    try:
        await db.commit()
        await db.refresh(request_obj)
    except Exception as e:
        await db.rollback()
        print(f"-> DB ERROR on update: {e}")
        raise HTTPException(status_code=500, detail="Update failed")

    # Create notification for student
    if status in ["accepted", "declined", "rejected"]:
        print(f"-> Notifying student ID {request_obj.student_id}")
        new_notification = Notification(
            user_id=request_obj.student_id,
            message=f"Your appointment for {request_obj.scheduled_time.strftime('%Y-%m-%d %H:%M')} has been {status}.",
        )
        db.add(new_notification)
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"-> Notification insert failed, continuing without notification: {e}")

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
            print(f"-> Email task scheduling failed on status update: {e}")

    try:
        await db.refresh(request_obj)
        
        # Load names for response
        s_name_res = await db.execute(select(User.username).where(User.id == request_obj.student_id))
        c_name_res = await db.execute(select(User.username).where(User.id == request_obj.counsellor_id))
        request_obj.student_name = s_name_res.scalar_one_or_none()
        request_obj.counsellor_name = c_name_res.scalar_one_or_none()
        
        print("-> Update successful.")
        return request_obj
    except Exception as e:
        await db.rollback()
        print(f"-> DB ERROR on update: {e}")
        raise HTTPException(status_code=500, detail="Update failed")