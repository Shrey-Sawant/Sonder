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
from jose import JWTError, jwt
from config.settings import settings

router = APIRouter(tags=["Auth"])

# In-memory OTP store (email: {otp, expires_at, user_data})
otp_store: dict[str, dict] = {}


# =========================
# REGISTER
# =========================
@router.post("/register", status_code=201)
async def register(
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Validate password length (bcrypt has 72 byte limit)
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
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Password processing error. Please use a simpler password."
        )

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

    # Counsellors — hold user data in memory until OTP is verified
    otp = "".join(random.choices(string.digits, k=6))
    email_str = str(user.email)
    otp_store[email_str] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
        "user_data": {
            "email": user.email,
            "username": user.username,
            "password": hashed_password,
            "role": user.role,
            "phone": user.phone,
            "experience": user.experience,
            "certification": user.certification,
        }
    }
    send_verification_email(email_str, otp)
    background_tasks.add_task(send_verification_email, email_str, otp)

    return {"message": "OTP sent to your email. Please verify to complete registration."}


# =========================
# VERIFY EMAIL
# =========================
@router.post("/verify-email")
async def verify_email(data: VerifyEmail, db: AsyncSession = Depends(get_db)):
    email_str = str(data.email)
    otp_entry = otp_store.get(email_str)

    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not found. Request a new one.")

    # Check expiry first and clean up
    if datetime.utcnow() > otp_entry["expires_at"]:
        otp_store.pop(email_str, None)
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if otp_entry["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # OTP valid — now create the user in DB
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

    # Clean up OTP store
    otp_store.pop(email_str, None)

    return {"message": "Email verified successfully. Registration complete."}

def send_email(to_email: str, subject: str, body: str) -> bool:
    print(f"DEBUG — MAIL_FROM: {settings.MAIL_FROM}")
    print(f"DEBUG — MAIL_SERVER: {settings.MAIL_SERVER}")
    print(f"DEBUG — MAIL_PORT: {settings.MAIL_PORT}")
    print(f"DEBUG — MAIL_USERNAME: {settings.MAIL_USERNAME}")
    print(f"DEBUG — MAIL_PASSWORD set: {bool(settings.MAIL_PASSWORD)}")
    print(f"DEBUG — Sending to: {to_email}")

    if not all([settings.MAIL_FROM, settings.MAIL_SERVER, settings.MAIL_PORT, settings.MAIL_USERNAME, settings.MAIL_PASSWORD]):
        print("DEBUG — One or more mail settings are missing!")
        return False
    ...
# =========================
# RESEND OTP
# =========================
@router.post("/resend-otp")
async def resend_otp(
    email: str,
    background_tasks: BackgroundTasks,
):
    otp_entry = otp_store.get(email)

    # User data must exist in store (registration was initiated)
    if not otp_entry or "user_data" not in otp_entry:
        raise HTTPException(
            status_code=404,
            detail="No pending registration found for this email. Please register first."
        )

    # Refresh OTP, preserve existing user_data
    otp = "".join(random.choices(string.digits, k=6))
    otp_store[email] = {
        **otp_entry,
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
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