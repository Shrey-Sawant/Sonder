from dotenv import load_dotenv

load_dotenv()

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler
from starlette.middleware.base import BaseHTTPMiddleware

from core.limiter import limiter
from api.v1.chatbot import router as chatbot_router
from api.v1.auth import router as auth_router
from api.v1.users import router as users_router
from api.v1.chat import router as chat_router
from api.v1.schedule import router as schedule_router
from api.v1.ratings import router as ratings_router
from api.v1.journal import router as journal_router
from api.v1.exercises import router as exercises_router
from api.v1.checkin import router as checkin_router

app = FastAPI(title="Sonder API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach a small set of hardening headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "geolocation=()")
        return response


app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# CORS: only the known first-party origins may call the API with credentials.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8081",
    "https://sonder-sigma.vercel.app",
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url and frontend_url not in origins:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(chatbot_router, prefix="/api/v1", tags=["chatbot"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(schedule_router, prefix="/api/v1/schedule", tags=["schedule"])
app.include_router(ratings_router, prefix="/api/v1/ratings", tags=["ratings"])
app.include_router(journal_router, prefix="/api/v1/journal", tags=["journal"])
app.include_router(exercises_router, prefix="/api/v1/exercises", tags=["exercises"])
app.include_router(checkin_router, prefix="/api/v1/checkin", tags=["checkin"])
from api.v1.reminders import router as reminders_router
app.include_router(reminders_router, prefix="/api/v1/reminders", tags=["reminders"])
from api.v1.notes import router as notes_router
app.include_router(notes_router, prefix="/api/v1/notes", tags=["notes"])

# Register new features
from api.v1.stories import router as stories_router
app.include_router(stories_router, prefix="/api/v1", tags=["stories"])
from api.v1.crisis import router as crisis_router
app.include_router(crisis_router, prefix="/api/v1", tags=["crisis"])
from api.v1.insights import router as insights_router
app.include_router(insights_router, prefix="/api/v1", tags=["insights"])
from api.v1.counselling_sessions import router as counselling_sessions_router
app.include_router(counselling_sessions_router, prefix="/api/v1", tags=["counselling-sessions"])
from api.v1.peer_chat import router as peer_chat_router
app.include_router(peer_chat_router, prefix="/api/v1", tags=["peer-chat"])
from api.v1.circles import router as circles_router
app.include_router(circles_router, prefix="/api/v1", tags=["circles"])

from services.scheduler import start_scheduler


@app.on_event("startup")
async def startup_event():
    start_scheduler()


@app.get("/")
def check_health():
    return {"status": "ok", "version": "1.0"}
