import asyncio
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from models.user import User
from core.security import get_password_hash
from config.settings import settings

async def create_admin():
    url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Check if admin already exists
        result = await session.execute(select(User).where(User.email == "admin@test.com"))
        existing = result.scalars().first()
        if existing:
            existing.is_approved = True
            await session.commit()
            print("Admin already exists, updated is_approved = True")
            return
            
        hashed_password = get_password_hash("password123")
        admin = User(
            email="admin@test.com",
            username="admin",
            password=hashed_password,
            role="admin",
            is_verified=True,
            is_approved=True
        )
        session.add(admin)
        await session.commit()
        print("Admin user created successfully: admin@test.com / password123")

if __name__ == "__main__":
    asyncio.run(create_admin())
