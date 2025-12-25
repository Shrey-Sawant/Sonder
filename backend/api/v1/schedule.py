from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from models.schedule_request import ScheduleRequest
from schemas.schedule import ScheduleRequestCreate, ScheduleRequestResponse
from models.user import User
from api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=ScheduleRequestResponse)
async def create_schedule_request(
    request: ScheduleRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_request = ScheduleRequest(
        student_id=request.student_id,
        counsellor_id=request.counsellor_id,
        scheduled_time=request.scheduled_time,
        status=request.status,
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    return new_request


@router.get("/", response_model=list[ScheduleRequestResponse])
async def get_schedule_requests(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if current_user.role == "student":
        stmt = select(ScheduleRequest).where(
            ScheduleRequest.student_id == current_user.id
        )
    elif current_user.role == "counsellor":
        stmt = select(ScheduleRequest).where(
            ScheduleRequest.counsellor_id == current_user.id
        )
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
    result = await db.execute(
        select(ScheduleRequest).where(ScheduleRequest.id == request_id)
    )
    request = result.scalars().first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    request.status = status
    await db.commit()
    await db.refresh(request)
    return request
