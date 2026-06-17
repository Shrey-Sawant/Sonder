from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: str


class UserCreate(UserBase):
    password: str
    phone: Optional[str] = None
    experience: Optional[int] = None
    certification: Optional[str] = None
    notify_on_crisis: Optional[bool] = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    phone: Optional[str] = None
    experience: Optional[int] = None
    certification: Optional[str] = None
    rating: float
    is_available: bool
    is_verified: bool
    is_approved: bool
    anon_id: Optional[str] = None
    anon_mode_enabled: Optional[bool] = True
    notify_on_crisis: Optional[bool] = True
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    id: int


class VerifyEmail(BaseModel):
    email: EmailStr
    otp: str
