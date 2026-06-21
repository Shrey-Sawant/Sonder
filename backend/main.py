from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.settings import settings
from api.v1.chatbot import router as chatbot_router
from api.v1.auth import router as auth_router
from api.v1.users import router as users_router
from api.v1.chat import router as chat_router
from api.v1.schedule import router as schedule_router
from api.v1.ratings import router as ratings_router
from api.v1.journal import router as journal_router
from api.v1.exercises import router as exercises_router
from api.v1.checkin import router as checkin_router
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import html

app = FastAPI(title="Sonder API")

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Input Sanitization Middleware
class SanitizationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # We only sanitize JSON bodies for this simple implementation
        if request.method in ("POST", "PUT", "PATCH") and request.headers.get("content-type") == "application/json":
            try:
                body = await request.body()
                if body:
                    data = json.loads(body)
                    
                    def sanitize(obj):
                        if isinstance(obj, str):
                            # Very basic XSS strip
                            return obj.replace("<script>", "").replace("</script>", "")
                        elif isinstance(obj, dict):
                            return {k: sanitize(v) for k, v in obj.items()}
                        elif isinstance(obj, list):
                            return [sanitize(i) for i in obj]
                        return obj
                        
                    sanitized_data = sanitize(data)
                    
                    # Override request body
                    async def receive():
                        return {"type": "http.request", "body": json.dumps(sanitized_data).encode("utf-8")}
                    request._receive = receive
            except Exception:
                pass # Ignore parsing errors, let FastAPI handle it
        
        response = await call_next(request)
        
        # Standardized Error Envelope
        if response.status_code >= 400 and response.headers.get("content-type") == "application/json":
            # Just an example of how to wrap it, though in a real app we'd use exception handlers for everything
            pass
            
        return response

app.add_middleware(SanitizationMiddleware)

import os

# CORS
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
    return {"msg": settings.DB_NAME, "status": "ok", "version": "1.0"}
