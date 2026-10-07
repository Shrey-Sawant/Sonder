from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.session import get_db
from models.rating import CounsellorRating
from schemas.rating import RatingCreate, RatingResponse
from models.user import User
from api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
async def create_rating(
    rating: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # The author is always the authenticated student, never a client-supplied id.
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can rate counsellors",
        )

    counsellor_res = await db.execute(
        select(User).where(
            User.id == rating.counsellor_id,
            User.role == "counsellor",
            User.is_verified.is_(True),
            User.is_approved.is_(True),
        )
    )
    counsellor = counsellor_res.scalars().first()
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")

    existing_res = await db.execute(
        select(CounsellorRating).where(
            CounsellorRating.student_id == current_user.id,
            CounsellorRating.counsellor_id == rating.counsellor_id,
        )
    )
    if existing_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already rated this counsellor",
        )

    new_rating = CounsellorRating(
        student_id=current_user.id,
        counsellor_id=rating.counsellor_id,
        rating=rating.rating,
        review=rating.review,
    )
    db.add(new_rating)
    await db.flush()

    # Keep the counsellor's aggregate rating in sync with submitted reviews.
    avg_res = await db.execute(
        select(func.avg(CounsellorRating.rating)).where(
            CounsellorRating.counsellor_id == rating.counsellor_id
        )
    )
    counsellor.rating = float(avg_res.scalar() or 0.0)

    await db.commit()
    await db.refresh(new_rating)
    return new_rating


@router.get("/{counsellor_id}", response_model=list[RatingResponse])
async def get_counsellor_ratings(
    counsellor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(CounsellorRating).where(
        CounsellorRating.counsellor_id == counsellor_id
    )
    result = await db.execute(stmt)
    return result.scalars().all()
