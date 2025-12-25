from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from models.rating import CounsellorRating
from schemas.rating import RatingCreate, RatingResponse
from models.user import User
from api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=RatingResponse)
async def create_rating(
    rating: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_rating = CounsellorRating(
        student_id=rating.student_id,
        counsellor_id=rating.counsellor_id,
        rating=rating.rating,
        review=rating.review,
    )
    db.add(new_rating)
    await db.commit()
    await db.refresh(new_rating)
    return new_rating


@router.get("/{counsellor_id}", response_model=list[RatingResponse])
async def get_counsellor_ratings(
    counsellor_id: int, db: AsyncSession = Depends(get_db)
):
    stmt = select(CounsellorRating).where(
        CounsellorRating.counsellor_id == counsellor_id
    )
    result = await db.execute(stmt)
    return result.scalars().all()
