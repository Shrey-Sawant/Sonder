"""Shared SlowAPI limiter.

Kept in its own module so API routers can attach per-route rate limits without
importing the FastAPI application module (which would create a circular import).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
