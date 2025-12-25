from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

url = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://", 1)
engine = create_async_engine(url)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with SessionLocal() as db:
        yield db