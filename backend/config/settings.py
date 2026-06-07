import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # =========================
    # DATABASE
    # =========================
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DATABASE_URL = os.getenv("DATABASE_URL")

    # =========================
    # AUTH
    # =========================
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

    # =========================
    # REDIS
    # =========================
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # =========================
    # EMAILJS (EMAIL SERVICE)
    # =========================
    EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID")
    EMAILJS_TEMPLATE_ID = os.getenv("EMAILJS_TEMPLATE_ID")
    EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY")
    EMAILJS_PRIVATE_KEY = os.getenv("EMAILJS_PRIVATE_KEY")

    # =========================
    # OPTIONAL (REMOVE SMTP COMPLETELY)
    # =========================
    # ❌ REMOVE THESE (not needed anymore)
    # MAIL_USERNAME
    # MAIL_PASSWORD
    # MAIL_FROM
    # MAIL_PORT
    # MAIL_SERVER

    # =========================
    # OPTIONAL (if you still use Resend somewhere)
    # =========================
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")


settings = Settings()