import os

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from config.settings import settings


def _database_url() -> str:
    """Resolve DATABASE_URL into an asyncpg-compatible SQLAlchemy URL."""
    url = (settings.DATABASE_URL or "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Set it in the environment or in "
            "the backend .env file before starting the API."
        )

    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgresql+asyncpg://"):
        return url

    raise RuntimeError(
        "DATABASE_URL must use a postgresql:// connection string."
    )


_url = _database_url()

_connect_args: dict = {}
# asyncpg caches prepared statements per connection, which breaks behind
# transaction-pooling proxies (Neon/Supabase poolers, pgbouncer). Detect the
# common pooler host suffix and disable the cache, or allow an explicit opt-in.
if "-pooler" in _url or os.getenv("DB_DISABLE_PREPARED_STATEMENTS") == "1":
    _connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    _url,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=_connect_args,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as db:
        yield db
