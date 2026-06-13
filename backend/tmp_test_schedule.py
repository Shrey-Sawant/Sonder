from dotenv import load_dotenv
load_dotenv()
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from models.user import User
import asyncio

url = os.getenv('DATABASE_URL').replace('postgresql://', 'postgresql+asyncpg://', 1)
engine = create_async_engine(url, echo=False)

async def main():
    async with AsyncSession(engine) as session:
        result = await session.execute(select(User).limit(20))
        users = result.scalars().all()
        for u in users:
            print(u.id, u.email, u.username, u.role, u.is_verified, u.is_approved)

asyncio.run(main())
