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

app = FastAPI(title="Sonder API")

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8081",
    "*",
]

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


@app.get("/")
def check_health():
    return {"msg": settings.DB_NAME, "status": "ok", "version": "1.0"}
