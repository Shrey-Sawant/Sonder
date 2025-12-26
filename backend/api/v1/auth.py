from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from db.session import get_db
from models.user import User
from schemas.user import UserCreate, UserLogin, UserResponse, Token, VerifyEmail
from core.security import get_password_hash, verify_password, create_access_token
from utils.email import send_verification_email
import random
import string

router = APIRouter(tags=["Auth"])

# In-memory OTP store (email: {otp, expires_at})
otp_store: dict[str, dict] = {}


# =========================
# REGISTER
# =========================
@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # ✅ Validate password length (bcrypt has 72 byte limit)
    if len(user.password.encode('utf-8')) > 72:
        raise HTTPException(
            status_code=400, 
            detail="Password is too long. Maximum 72 characters allowed."
        )
    
    if len(user.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long."
        )

    # Check email
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check username
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Hash password
    try:
        hashed_password = get_password_hash(user.password)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Password processing error. Please use a simpler password."
        )

    # Auto-verify students & admins
    is_verified = user.role in {"student", "admin"}

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

    # Counsellor email verification
    if user.role == "counsellor":
        otp = "".join(random.choices(string.digits, k=6))
        otp_store[user.email] = {
            "otp": otp,
            "expires_at": datetime.utcnow() + timedelta(minutes=5)
        }
        background_tasks.add_task(send_verification_email, user.email, otp)

    return new_user


# =========================
# VERIFY EMAIL
# =========================
@router.post("/verify-email")
async def verify_email(data: VerifyEmail, db: AsyncSession = Depends(get_db)):
    otp_entry = otp_store.get(data.email)

    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not found. Request a new one.")
    
    if otp_entry["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if datetime.utcnow() > otp_entry["expires_at"]:
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    # Mark user as verified
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    await db.commit()

    # Remove OTP after verification
    otp_store.pop(data.email, None)

    return {"message": "Email verified successfully"}


# =========================
# RESEND OTP
# =========================
@router.post("/resend-otp")
async def resend_otp(
    email: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="User already verified")

    otp = "".join(random.choices(string.digits, k=6))
    otp_store[email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=5)
    }
    background_tasks.add_task(send_verification_email, email, otp)

    return {"message": "OTP resent successfully"}


# =========================
# LOGIN
# =========================
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