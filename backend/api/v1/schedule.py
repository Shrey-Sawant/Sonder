from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select
from datetime import date, time, datetime
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Boolean
from sqlalchemy.sql import func
from db.session import Base, get_db
from models.schedule_request import ScheduleRequest
from models.user import User
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from api.deps import get_current_user

router = APIRouter()

# --- Internal Notification Model ---
# (Note: Usually this lives in models/notification.py, but kept here as per your snippet)
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

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

    # counsellor_id is already an int via FastAPI path/query validation
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure variables are strictly Python integers
    try:
        c_id = int(request.counsellor_id)
        s_id = int(current_user.id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="IDs must be valid integers")

    # 1. Conflict Check
    conflict_check = await db.execute(
        select(ScheduleRequest).where(
            and_(
                ScheduleRequest.counsellor_id == c_id,
                ScheduleRequest.scheduled_time == request.scheduled_time,
                ScheduleRequest.status.in_(["pending", "accepted"])
            )
        )
    )
    
    if conflict_check.scalars().first():
        raise HTTPException(status_code=400, detail="This time slot is already booked.")

    # 2. Create the entry - Force cast to int here
    new_request = ScheduleRequest(
        student_id=int(s_id),        # Explicit cast
        counsellor_id=int(c_id),    # Explicit cast
        scheduled_time=request.scheduled_time,
        status="pending",
    )
    db.add(new_request)

    # 3. Notification
    notification = Notification(
        user_id=int(c_id),          # Explicit cast
        message=f"New request for {request.scheduled_time.strftime('%Y-%m-%d %H:%M')}."
    )
    db.add(notification)
    
    try:
        await db.commit()
        await db.refresh(new_request)
        return new_request
    except Exception as e:
        await db.rollback()
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Could not save booking")

@router.get("/", response_model=list[ScheduleRequestResponse])
async def get_schedule_requests(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Filters based on role
    if current_user.role == "student":
        stmt = select(ScheduleRequest).where(ScheduleRequest.student_id == current_user.id)
    elif current_user.role == "counsellor":
        stmt = select(ScheduleRequest).where(ScheduleRequest.counsellor_id == current_user.id)
    else:
        stmt = select(ScheduleRequest)

    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{request_id}", response_model=ScheduleRequestResponse)
async def update_schedule_status(
    request_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Authorization: Only counsellors or admin should update status
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")

    result = await db.execute(
        select(ScheduleRequest).where(ScheduleRequest.id == request_id)
    )
    request_obj = result.scalars().first()
    
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")

    request_obj.status = status
    
    # Create notification for student
    if status in ["accepted", "declined", "rejected"]:
        new_notification = Notification(
            user_id=request_obj.student_id,
            message=f"Your appointment for {request_obj.scheduled_time.strftime('%Y-%m-%d %H:%M')} has been {status}."
        )
        db.add(new_notification)

    await db.commit()
    await db.refresh(request_obj)
    return request_obj