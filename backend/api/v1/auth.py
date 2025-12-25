from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from models.user import User
from schemas.user import UserCreate, UserLogin, UserResponse, Token, VerifyEmail
from core.security import get_password_hash, verify_password, create_access_token
from utils.email import send_verification_email
import random
import string

router = APIRouter()

# Simple in-memory OTP store (production should use Redis or DB)
otp_store = {}


@router.post("/register", response_model=UserResponse)
async def register(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Hash password
    hashed_password = get_password_hash(user.password)

    # Determine initial verification status
    # Students and admins are auto-verified, only counsellors need email verification
    is_verified = user.role in ["student", "admin"]

    new_user = User(
        email=user.email,
        username=user.username,
        password=hashed_password,
        role=user.role,
        phone=user.phone,
        experience=user.experience,
        certification=user.certification,
        is_verified=is_verified,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    if user.role == "counsellor":
        # Generate OTP
        otp = "".join(random.choices(string.digits, k=6))
        otp_store[user.email] = otp
        # Send Email
        background_tasks.add_task(send_verification_email, user.email, otp)

    return new_user


@router.post("/verify-email")
async def verify_email(data: VerifyEmail, db: AsyncSession = Depends(get_db)):
    stored_otp = otp_store.get(data.email)
    if not stored_otp or stored_otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Update user status
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    await db.commit()

    # clear otp
    del otp_store[data.email]

    return {"message": "Email verified successfully"}


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()

    if not user or not verify_password(user_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please verify your email first.",
        )

    access_token = create_access_token(data={"sub": user.email, "role": user.role})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "id": user.id,
    }
