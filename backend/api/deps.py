from typing import Generator, Optional
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from models.user import User
from config.settings import settings
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_WS_AUTH_SUBPROTOCOL = "sonder-auth"


def _offered_subprotocols(websocket: WebSocket) -> list:
    raw = websocket.headers.get("sec-websocket-protocol")
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def ws_auth_subprotocol(websocket: WebSocket) -> Optional[str]:
    """Return the subprotocol to echo when accepting a WebSocket connection."""
    if _WS_AUTH_SUBPROTOCOL in _offered_subprotocols(websocket):
        return _WS_AUTH_SUBPROTOCOL
    return None


def extract_ws_token(websocket: WebSocket) -> Optional[str]:
    """Extract the bearer token from a WebSocket handshake.

    Prefers the ``Sec-WebSocket-Protocol`` handshake value (offered as
    ``sonder-auth, <jwt>``) so the token is not embedded in the request URL,
    where it would leak into access logs and referrers. Falls back to the
    legacy ``?token=`` query parameter for backwards compatibility.
    """
    protocols = _offered_subprotocols(websocket)
    if _WS_AUTH_SUBPROTOCOL in protocols:
        idx = protocols.index(_WS_AUTH_SUBPROTOCOL)
        if idx + 1 < len(protocols) and protocols[idx + 1]:
            return protocols[idx + 1]
    return websocket.query_params.get("token")


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    # ``is_available`` tracks counsellor availability, not account status, so it
    # must not be used as an activation flag here.
    if not current_user.is_verified or not current_user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )
    return current_user
