from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select
from datetime import date, time, datetime
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Boolean
from sqlalchemy.sql import func

# Internal project imports - Ensure these paths match your structure
from db.session import Base, get_db
from models.schedule_request import ScheduleRequest
from models.user import User
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from api.deps import get_current_user

router = APIRouter()

# --- Internal Notification Model ---
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

    # 2. Create the entry
    new_request = ScheduleRequest(
        student_id=s_id,
        counsellor_id=c_id,
        scheduled_time=request.scheduled_time,
        status="pending",
    )
    db.add(new_request)

    # 3. Notification for Counselor
    notification = Notification(
        user_id=c_id,
        message=f"New appointment request for {request.scheduled_time.strftime('%Y-%m-%d %H:%M')}."
    )
    db.add(notification)
    
    try:
        await db.commit()
        await db.refresh(new_request)
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

    # Filters based on role
    if current_user.role == "student":
        stmt = select(ScheduleRequest).where(ScheduleRequest.student_id == current_user.id)
    elif current_user.role == "counsellor":
        stmt = select(ScheduleRequest).where(ScheduleRequest.counsellor_id == current_user.id)
    else:
        print("-> Admin/Other role: fetching all records")
        stmt = select(ScheduleRequest)

    result = await db.execute(stmt)
    items = result.scalars().all()
    print(f"-> Returning {len(items)} records.")
    return items


@router.put("/{request_id}", response_model=ScheduleRequestResponse)
async def update_schedule_status(
    request_id: int,
    status: str,
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
    
    # Create notification for student
    if status in ["accepted", "declined", "rejected"]:
        print(f"-> Notifying student ID {request_obj.student_id}")
        new_notification = Notification(
            user_id=request_obj.student_id,
            message=f"Your appointment for {request_obj.scheduled_time.strftime('%Y-%m-%d %H:%M')} has been {status}."
        )
        db.add(new_notification)

    try:
        await db.commit()
        await db.refresh(request_obj)
        print("-> Update successful.")
        return request_obj
    except Exception as e:
        await db.rollback()
        print(f"-> DB ERROR on update: {e}")
        raise HTTPException(status_code=500, detail="Update failed")