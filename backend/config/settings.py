import os
from dotenv import load_dotenv

load_dotenv()  


class Settings:
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Auth
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

    # SMTP
    MAIL_USERNAME = os.getenv("SMTP_USER")
    MAIL_PASSWORD = os.getenv("SMTP_PASSWORD")
    MAIL_FROM = os.getenv("SMTP_USER")
    MAIL_PORT = int(os.getenv("SMTP_PORT", 587))
    MAIL_SERVER = os.getenv("SMTP_HOST", "smtp.gmail.com")

settings = Settings()
