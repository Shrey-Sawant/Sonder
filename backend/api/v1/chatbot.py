from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db.session import get_db
from services.chatbot import chat_with_ai
from api.deps import get_current_user
from core.limiter import limiter
from models.user import User

router = APIRouter(prefix="/chatbot")


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await chat_with_ai(current_user.id, payload.message, db)
