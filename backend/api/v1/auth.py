from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from db.session import get_db
from models.user import User
from schemas.user import UserCreate, UserLogin, Token, VerifyEmail
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

# =========================
# REDIS INIT
# =========================
try:
    redis_client = redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=3,
    )
    redis_client.ping()
    logger.info("Redis connected successfully")
except Exception as e:
    logger.error(f"Redis connection failed (OTP disabled): {e}")
    redis_client = None


# =========================
# REDIS HELPERS
# =========================
def _require_redis():
    if redis_client is None:
        raise HTTPException(
            status_code=503,
            detail="OTP service is temporarily unavailable"
        )


def store_otp(email: str, data: dict, ttl_seconds: int = 300):
    _require_redis()
    try:
        redis_client.setex(
            f"otp:{email}",
            ttl_seconds,
            json.dumps(data)
        )
    except Exception as e:
        logger.error(f"Redis store failed: {e}")
        raise HTTPException(status_code=503, detail="OTP service unavailable")


def get_otp(email: str):
    _require_redis()
    try:
        val = redis_client.get(f"otp:{email}")
        return json.loads(val) if val else None
    except Exception as e:
        logger.error(f"Redis get failed: {e}")
        raise HTTPException(status_code=503, detail="OTP service unavailable")


def delete_otp(email: str):
    if redis_client:
        try:
            redis_client.delete(f"otp:{email}")
        except Exception as e:
            logger.warning(f"Redis delete failed: {e}")


# =========================
# REGISTER
# =========================
@router.post("/register", status_code=201)
async def register(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 chars)")

    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # check email
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # check username
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_password = get_password_hash(user.password)

    # Direct registration (no OTP)
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

    # OTP flow (counsellor)
    otp = "".join(random.choices(string.digits, k=6))
    email_str = str(user.email)

    store_otp(email_str, {
        "otp": otp,
        "expires_at": (
            datetime.utcnow() + timedelta(minutes=5)
        ).isoformat(),
        "user_data": {
            "email": email_str,
            "username": user.username,
            "password": hashed_password,
            "role": user.role,
            "phone": user.phone,
            "experience": user.experience,
            "certification": user.certification,
        }
    })

    # ONLY send via background task (NO duplicate call)
    background_tasks.add_task(
        send_verification_email,
        email_str,
        otp
    )

    logger.info(f"OTP sent to {email_str}")

    return {"message": "OTP sent to email. Please verify to complete registration."}


# =========================
# VERIFY EMAIL
# =========================
@router.post("/verify-email")
async def verify_email(
    data: VerifyEmail,
    db: AsyncSession = Depends(get_db)
):
    email = str(data.email)
    otp_entry = get_otp(email)

    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not found")

    if datetime.utcnow() > datetime.fromisoformat(otp_entry["expires_at"]):
        delete_otp(email)
        raise HTTPException(status_code=400, detail="OTP expired")

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

    delete_otp(email)

    return {"message": "Email verified successfully"}


# =========================
# RESEND OTP
# =========================
@router.post("/resend-otp")
async def resend_otp(
    email: str,
    background_tasks: BackgroundTasks,
):
    otp_entry = get_otp(email)

    if not otp_entry:
        raise HTTPException(status_code=404, detail="No pending OTP found")

    otp = "".join(random.choices(string.digits, k=6))

    store_otp(email, {
        **otp_entry,
        "otp": otp,
        "expires_at": (
            datetime.utcnow() + timedelta(minutes=5)
        ).isoformat(),
    })

    background_tasks.add_task(
        send_verification_email,
        email,
        otp
    )

    return {"message": "OTP resent successfully"}


# =========================
# LOGIN
# =========================
@router.post("/login", response_model=Token)
async def login(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )

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
            detail="Email not verified",
        )

    token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "id": user.id,
    }


# =========================
# CURRENT USER
# =========================
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:

    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        email = payload.get("sub")
        if not email:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalars().first()

    if not user:
        raise credentials_exception

    return user