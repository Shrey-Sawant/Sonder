from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from groq import Groq
import os

from models.chat_session import ChatSession
from models.chat_message import ChatMessage

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def chat_with_ai(user_id: int, user_message: str, db: AsyncSession):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.student_id == user_id,
            ChatSession.chat_type == "ai",
            ChatSession.status == "active"
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        session = ChatSession(student_id=user_id, chat_type="ai", status="active")
        db.add(session)
        await db.commit()
        await db.refresh(session)
    
    db.add(ChatMessage(session_id=session.id, sender_role="student", message=user_message))
    await db.commit()
    
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(desc(ChatMessage.created_at))
        .limit(10)
    )
    history = list(reversed(result.scalars().all()))
    messages = [{"role": "system", "content": """You are Sonder AI, a caring mental health companion for students.

Your style:
- Talk like a supportive friend, not a therapist
- Use simple, warm language
- Keep responses short (2-3 paragraphs max)
- Ask gentle questions to understand better

Your approach:
- Listen without judgment
- Offer small, practical coping ideas when appropriate
- Remind them they're not alone

Important boundaries:
- If they mention self-harm, suicide, or severe crisis → strongly encourage them to talk to a counselor or call a helpline immediately
- Don't diagnose mental health conditions
- Don't give medical advice

Your goal is to make them feel heard, understood, and a little less alone."""}]
    for msg in history:
        role = "user" if msg.sender_role == "student" else "assistant"
        messages.append({"role": role, "content": msg.message})
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        messages=messages
    )
    
    ai_reply = response.choices[0].message.content
    
    db.add(ChatMessage(session_id=session.id, sender_role="ai", message=ai_reply))
    await db.commit()
    
    return ai_reply