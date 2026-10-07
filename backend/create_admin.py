"""Create or promote the initial administrator account.

Credentials are read from the environment -- no default password is ever
hard-coded. Usage:

    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=<strong-password> python create_admin.py
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from models.user import User
from core.security import get_password_hash
from utils.anon_id import generate_anon_id
from config.settings import settings

_WEAK_PASSWORDS = {
    "password",
    "password123",
    "admin",
    "admin123",
    "changeme",
    "letmein",
}


async def _unique_anon_id(session) -> str:
    """Generate an anon_id that is not already taken (unique constraint safe)."""
    while True:
        candidate = generate_anon_id()
        result = await session.execute(select(User).where(User.anon_id == candidate))
        if result.scalars().first() is None:
            return candidate


async def create_admin() -> None:
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")

    if not email or not password:
        raise SystemExit(
            "ADMIN_EMAIL and ADMIN_PASSWORD must be set to create an admin."
        )
    if len(password) < 12:
        raise SystemExit("ADMIN_PASSWORD must be at least 12 characters.")
    if password.lower() in _WEAK_PASSWORDS:
        raise SystemExit("Refusing to use a well-known default password.")

    url = settings.DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(url)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalars().first()
        if existing:
            existing.role = "admin"
            existing.is_verified = True
            existing.is_approved = True
            if existing.anon_id is None:
                existing.anon_id = await _unique_anon_id(session)
            await session.commit()
            print(f"Promoted existing account {email} to admin.")
            return

        admin = User(
            email=email,
            username=os.getenv("ADMIN_USERNAME", "admin"),
            password=get_password_hash(password),
            role="admin",
            anon_id=await _unique_anon_id(session),
            is_verified=True,
            is_approved=True,
        )
        session.add(admin)
        await session.commit()
        print(f"Admin account created for {email}.")


if __name__ == "__main__":
    asyncio.run(create_admin())
