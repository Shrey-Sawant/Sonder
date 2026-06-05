from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
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
import json
import logging
import redis
from jose import JWTError, jwt

logger = logging.getLogger(__name__)
from config.settings import settings

router = APIRouter(tags=["Auth"])

# Redis client
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


# =========================
# REDIS HELPERS
# =========================
def store_otp(email: str, data: dict, ttl_seconds: int = 300):
    redis_client.setex(f"otp:{email}", ttl_seconds, json.dumps(data))

def get_otp(email: str) -> dict | None:
    val = redis_client.get(f"otp:{email}")
    return json.loads(val) if val else None

def delete_otp(email: str):
    redis_client.delete(f"otp:{email}")


# =========================
# REGISTER
# =========================
@router.post("/register", status_code=201)
async def register(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if len(user.password.encode('utf-8')) > 72:
        raise HTTPException(status_code=400, detail="Password is too long. Maximum 72 characters allowed.")

    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken")

    try:
        hashed_password = get_password_hash(user.password)
    except Exception:
        raise HTTPException(status_code=400, detail="Password processing error. Please use a simpler password.")

    # Students & admins — save immediately, no OTP needed
    if user.role in {"student", "admin"}:
        new_user = User(
            email=user.email,
            username=user.username,
            password=hashed_password,
            role=user.role,
            phone=user.phone,
            experience=user.experience,
            certification=user.certification,
            is_verified=True,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    # Counsellors — store in Redis until OTP verified
    otp = "".join(random.choices(string.digits, k=6))
    email_str = str(user.email)
    store_otp(email_str, {
        "otp": otp,
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        "user_data": {
            "email": str(user.email),
            "username": user.username,
            "password": hashed_password,
            "role": user.role,
            "phone": user.phone,
            "experience": user.experience,
            "certification": user.certification,
        }
    })
    background_tasks.add_task(send_verification_email, email_str, otp)

    result = send_verification_email(email_str, otp)
    logger.info(f"Email send result: {result}")

    return {"message": "OTP sent to your email. Please verify to complete registration."}


# =========================
# VERIFY EMAIL
# =========================
@router.post("/verify-email")
async def verify_email(data: VerifyEmail, db: AsyncSession = Depends(get_db)):
    email_str = str(data.email)
    otp_entry = get_otp(email_str)

    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not found. Request a new one.")

    if datetime.utcnow() > datetime.fromisoformat(otp_entry["expires_at"]):
        delete_otp(email_str)
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if otp_entry["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user_data = otp_entry["user_data"]
    new_user = User(
        email=user_data["email"],
        username=user_data["username"],
        password=user_data["password"],
        role=user_data["role"],
        phone=user_data["phone"],
        experience=user_data["experience"],
        certification=user_data["certification"],
        is_verified=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    delete_otp(email_str)

    return {"message": "Email verified successfully. Registration complete."}


# =========================
# RESEND OTP
# =========================
@router.post("/resend-otp")
async def resend_otp(
    email: str,
    background_tasks: BackgroundTasks,
):
    otp_entry = get_otp(email)

    if not otp_entry or "user_data" not in otp_entry:
        raise HTTPException(
            status_code=404,
            detail="No pending registration found for this email. Please register first."
        )

    otp = "".join(random.choices(string.digits, k=6))
    store_otp(email, {
        **otp_entry,
        "otp": otp,
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
    })
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


# =========================
# GET CURRENT USER DEPENDENCY
# =========================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_email: str = payload.get("sub")
        if user_email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user