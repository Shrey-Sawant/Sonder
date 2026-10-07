from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
import secrets
import json
import logging
import redis
from pydantic import BaseModel, EmailStr

from db.session import get_db
from models.user import User
from api.deps import get_current_user
from schemas.user import UserCreate, UserLogin, Token, VerifyEmail
from core.security import get_password_hash, verify_password, create_access_token
from core.limiter import limiter
from utils.email import send_verification_email
from utils.anon_id import generate_anon_id
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Auth"])

OTP_TTL_SECONDS = 300
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60

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
            detail="OTP service is temporarily unavailable",
        )


def _generate_otp() -> str:
    # secrets.randbelow is cryptographically secure, unlike random.choices.
    return f"{secrets.randbelow(1_000_000):06d}"


def _otp_key(email: str) -> str:
    return f"otp:{email}"


def store_otp(email: str, data: dict, ttl_seconds: int = OTP_TTL_SECONDS):
    _require_redis()
    try:
        redis_client.setex(_otp_key(email), ttl_seconds, json.dumps(data))
    except Exception as e:
        logger.error(f"Redis store failed: {e}")
        raise HTTPException(status_code=503, detail="OTP service unavailable")


def get_otp(email: str):
    _require_redis()
    try:
        val = redis_client.get(_otp_key(email))
        return json.loads(val) if val else None
    except Exception as e:
        logger.error(f"Redis get failed: {e}")
        raise HTTPException(status_code=503, detail="OTP service unavailable")


def delete_otp(email: str):
    if redis_client:
        try:
            redis_client.delete(_otp_key(email))
        except Exception as e:
            logger.warning(f"Redis delete failed: {e}")


def _record_failed_attempt(email: str, entry: dict) -> None:
    """Persist a failed verification while keeping the remaining TTL."""
    entry["attempts"] = int(entry.get("attempts", 0)) + 1
    if redis_client is None:
        return
    ttl = redis_client.ttl(_otp_key(email))
    if not isinstance(ttl, int) or ttl <= 0:
        ttl = OTP_TTL_SECONDS
    redis_client.setex(_otp_key(email), ttl, json.dumps(entry))


# =========================
# HELPER
# =========================
async def get_unique_anon_id(db: AsyncSession) -> str:
    while True:
        candidate = generate_anon_id()
        stmt = select(User).where(User.anon_id == candidate)
        res = await db.execute(stmt)
        if not res.scalars().first():
            return candidate


class ResendOTPRequest(BaseModel):
    email: EmailStr


# =========================
# REGISTER
# =========================
@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
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

    # Generate unique anon id
    anon_id = await get_unique_anon_id(db)

    # Students can register directly; counsellors must verify their email.
    if user.role == "student":
        new_user = User(
            email=user.email,
            username=user.username,
            password=hashed_password,
            role=user.role,
            phone=user.phone,
            experience=user.experience,
            certification=user.certification,
            anon_id=anon_id,
            notify_on_crisis=user.notify_on_crisis if user.notify_on_crisis is not None else True,
            is_verified=True,
            is_approved=True,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return {"message": "Registration successful. You can now sign in."}

    # OTP flow (counsellor)
    otp = _generate_otp()
    email_str = str(user.email)
    now = datetime.now(timezone.utc)

    store_otp(email_str, {
        "otp": otp,
        "attempts": 0,
        "last_sent_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
        # NOTE: the password is already bcrypt-hashed; the plaintext is never
        # stored in Redis or logged.
        "user_data": {
            "email": email_str,
            "username": user.username,
            "password": hashed_password,
            "role": user.role,
            "phone": user.phone,
            "experience": user.experience,
            "certification": user.certification,
            "anon_id": anon_id,
            "notify_on_crisis": user.notify_on_crisis if user.notify_on_crisis is not None else True
        }
    })

    background_tasks.add_task(send_verification_email, email_str, otp)

    logger.info("Counsellor verification email queued for %s", email_str)

    return {"message": "OTP sent to email. Please verify to complete registration."}


# =========================
# VERIFY EMAIL
# =========================
@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    data: VerifyEmail,
    db: AsyncSession = Depends(get_db),
):
    email = str(data.email)
    otp_entry = get_otp(email)

    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not found or expired")

    if int(otp_entry.get("attempts", 0)) >= OTP_MAX_ATTEMPTS:
        delete_otp(email)
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Request a new code.",
        )

    expires_at = otp_entry.get("expires_at")
    if expires_at:
        try:
            expired = datetime.now(timezone.utc) > datetime.fromisoformat(expires_at)
        except ValueError:
            expired = True
        if expired:
            delete_otp(email)
            raise HTTPException(status_code=400, detail="OTP expired")

    # Constant-time comparison to avoid leaking the code via timing.
    if not secrets.compare_digest(str(otp_entry.get("otp", "")), str(data.otp)):
        _record_failed_attempt(email, otp_entry)
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user_data = otp_entry["user_data"]

    # Re-check uniqueness in case the address/username was claimed after the
    # OTP was issued.
    existing = await db.execute(
        select(User).where(
            (User.email == user_data["email"]) | (User.username == user_data["username"])
        )
    )
    if existing.scalars().first():
        delete_otp(email)
        raise HTTPException(status_code=400, detail="Email or username already registered")

    new_user = User(
        email=user_data["email"],
        username=user_data["username"],
        password=user_data["password"],
        role=user_data["role"],
        phone=user_data["phone"],
        experience=user_data["experience"],
        certification=user_data["certification"],
        anon_id=user_data["anon_id"],
        notify_on_crisis=user_data.get("notify_on_crisis", True),
        is_verified=True,
        is_approved=False,
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
@limiter.limit("3/minute")
async def resend_otp(
    request: Request,
    data: ResendOTPRequest,
    background_tasks: BackgroundTasks,
):
    email = str(data.email)
    # Generic response regardless of whether a registration is pending, so the
    # endpoint cannot be used to enumerate accounts.
    generic_response = {
        "message": "If a verification is pending for this address, a new code has been sent."
    }

    otp_entry = get_otp(email)
    if not otp_entry:
        return generic_response

    last_sent_at = otp_entry.get("last_sent_at")
    if last_sent_at:
        try:
            elapsed = datetime.now(timezone.utc) - datetime.fromisoformat(last_sent_at)
            if elapsed < timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS):
                return generic_response
        except ValueError:
            pass

    otp = _generate_otp()
    now = datetime.now(timezone.utc)
    otp_entry.update({
        "otp": otp,
        "attempts": 0,
        "last_sent_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
    })
    store_otp(email, otp_entry)

    background_tasks.add_task(send_verification_email, email, otp)

    return generic_response


# =========================
# LOGIN
# =========================
@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db),
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

    if not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Your registration is pending administrator approval.",
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

