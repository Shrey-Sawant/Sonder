import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()


async def add_column():
    url = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url)

    async with engine.connect() as conn:
        try:
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE")
            )
            await conn.commit()
            print("Successfully added is_verified column")
        except Exception as e:
            print(f"Error (maybe column exists): {e}")


if __name__ == "__main__":
    asyncio.run(add_column())
