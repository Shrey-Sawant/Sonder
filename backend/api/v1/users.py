from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from schemas.user import UserResponse
from models.user import User
from api.deps import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=list[UserResponse])
async def read_users(role: str = None, db: AsyncSession = Depends(get_db)):
    # In a real app, maybe strict admin or public list for counselors
    if role:
        stmt = select(User).where(User.role == role)
    else:
        stmt = select(User)
    result = await db.execute(stmt)
    return result.scalars().all()
