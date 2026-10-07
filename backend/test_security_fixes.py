"""
Regression tests for the security fixes.

Runs without pytest or a live database:

    python test_security_fixes.py

Authorization/validation checks run against the real ASGI application with the
database dependency stubbed out, so they exercise the actual routers and
dependencies rather than mocks of the code under test.
"""

import asyncio
import os
import sys
import uuid

# Must be set before importing config.settings: backend/.env sets
# ENV=production but ships without a SECRET_KEY.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0123456789")
os.environ.setdefault("ENV", "development")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cryptography.fernet import Fernet  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from jose import jwt  # noqa: E402

from main import app  # noqa: E402
from api.deps import get_current_user  # noqa: E402
from api.deps import extract_ws_token  # noqa: E402
from db.session import get_db  # noqa: E402
from models.user import User  # noqa: E402
from config.settings import settings  # noqa: E402
from core import encryption  # noqa: E402
from core.security import (  # noqa: E402
    create_access_token,
    get_password_hash,
    verify_password,
)
from services.crisis_detector import CrisisDetector  # noqa: E402
from services.care_relationships import student_belongs_to_counsellor  # noqa: E402
from sqlalchemy.dialects import postgresql  # noqa: E402

_results = {"passed": 0, "failed": 0}


def check(name: str, condition: bool, detail="") -> None:
    if condition:
        _results["passed"] += 1
        print(f"  PASS  {name}")
    else:
        _results["failed"] += 1
        suffix = f" ({detail})" if detail != "" else ""
        print(f"  FAIL  {name}{suffix}")


def _make_user(role: str) -> User:
    return User(
        id=1001,
        user_id=uuid.uuid4(),
        username=f"{role}_tester",
        email=f"{role}_tester@example.com",
        password="irrelevant",
        role=role,
        anon_id=f"{role}Anon001",
        is_verified=True,
        is_approved=True,
    )


class _UnavailableDB:
    """Stands in for the database so authorization paths run without one."""

    async def execute(self, *args, **kwargs):
        raise RuntimeError("database not available in regression tests")

    async def commit(self):
        raise RuntimeError("database not available in regression tests")

    async def rollback(self):
        pass

    async def refresh(self, *args, **kwargs):
        pass

    def add(self, *args, **kwargs):
        pass


async def _override_db():
    yield _UnavailableDB()


class _FakeWebSocket:
    def __init__(self, headers=None, query=None):
        self.headers = headers or {}
        self.query_params = query or {}


class _ScriptedResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def first(self):
        return self._values[0] if self._values else None

    def all(self):
        return list(self._values)

    def scalar_one_or_none(self):
        return self._values[0] if self._values else None


class _ScriptedDB:
    """Returns queued query results so authz logic can be exercised without a DB."""

    def __init__(self, results=None):
        self._results = list(results or [])
        self.added = []

    async def execute(self, *args, **kwargs):
        return _ScriptedResult(self._results.pop(0) if self._results else [])

    async def commit(self):
        pass

    async def rollback(self):
        pass

    async def refresh(self, *args, **kwargs):
        pass

    def add(self, obj):
        self.added.append(obj)

    def add_all(self, objs):
        self.added.extend(objs)


def _override_db_with(db):
    async def _dependency():
        yield db

    return _dependency


def test_ws_token_extraction() -> None:
    print("websocket token extraction")
    ws = _FakeWebSocket(headers={"sec-websocket-protocol": "sonder-auth, abc.def.ghi"})
    check("prefers the subprotocol token", extract_ws_token(ws) == "abc.def.ghi")
    ws = _FakeWebSocket(query={"token": "legacy-token"})
    check("falls back to the query token", extract_ws_token(ws) == "legacy-token")
    ws = _FakeWebSocket(
        headers={"sec-websocket-protocol": "sonder-auth"},
        query={"token": "legacy"},
    )
    check("falls back when the subprotocol carries no token", extract_ws_token(ws) == "legacy")
    ws = _FakeWebSocket(headers={"sec-websocket-protocol": "chat, sonder-auth, tok123"})
    check("finds the token after other protocols", extract_ws_token(ws) == "tok123")


def test_care_relationship_scoping() -> None:
    print("care relationship scoping")
    counsellor = _make_user("counsellor")
    clause = student_belongs_to_counsellor(counsellor, User.id, User.user_id)
    compiled = str(clause.compile(dialect=postgresql.dialect()))
    check("scopes by appointments", "schedule_requests" in compiled, compiled)
    check("scopes by chat sessions", "chat_sessions" in compiled, compiled)
    check("scopes by counselling sessions", "counselling_sessions" in compiled, compiled)
    check("uses OR across relationships", " OR " in compiled.upper(), compiled)


def test_crypto() -> None:
    print("crypto")
    token = encryption.encrypt_string("hello sonder")
    check("round-trips a value", encryption.decrypt_string(token) == "hello sonder")
    check("encrypts empty as None", encryption.encrypt_string("") is None)
    check("decrypts None as None", encryption.decrypt_string(None) is None)

    os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()
    encryption._build_cipher.cache_clear()
    try:
        encryption.decrypt_string(token)
        wrong_key_rejected = False
    except ValueError:
        wrong_key_rejected = True
    check("rejects a token encrypted under a different key", wrong_key_rejected)

    os.environ.pop("ENCRYPTION_KEY", None)
    encryption._build_cipher.cache_clear()
    check("dev-derived key is stable", encryption.decrypt_string(token) == "hello sonder")


def test_password_and_tokens() -> None:
    print("password + tokens")
    hashed = get_password_hash("a-strong-passphrase")
    check("verifies the correct password", verify_password("a-strong-passphrase", hashed))
    check("rejects a wrong password", not verify_password("nope", hashed))
    check("rejects a malformed hash", not verify_password("x", "not-a-hash"))

    token = create_access_token({"sub": "student@example.com", "role": "student"})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    check("token carries jti", bool(payload.get("jti")))
    check("token carries iat", bool(payload.get("iat")))
    check("token carries nbf", bool(payload.get("nbf")))
    check("token is typed as access", payload.get("type") == "access")
    check("token preserves the subject", payload.get("sub") == "student@example.com")


def test_crisis_fallback() -> None:
    print("crisis detection fallback")
    detector = CrisisDetector()
    check(
        "HIGH on a self-harm phrase",
        detector._keyword_assessment("i want to die")["risk_level"] == "HIGH",
    )
    check(
        "MEDIUM on hopelessness",
        detector._keyword_assessment("i feel hopeless")["risk_level"] == "MEDIUM",
    )
    check(
        "LOW on ordinary stress",
        detector._keyword_assessment("busy week ahead")["risk_level"] == "LOW",
    )
    check("empty text is LOW", detector._keyword_assessment("")["risk_level"] == "LOW")


def test_scheduled_time_normalization() -> None:
    print("schedule time normalization")
    from datetime import datetime, timedelta, timezone

    from api.v1.schedule import _normalize_scheduled_time

    aware = datetime(2030, 1, 1, 12, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    normalized = _normalize_scheduled_time(aware)
    check("strips timezone info", normalized.tzinfo is None)
    check(
        "converts tz-aware values to UTC",
        (normalized.hour, normalized.minute) == (6, 30),
        normalized,
    )
    naive = datetime(2030, 1, 1, 12, 0)
    check("leaves naive values unchanged", _normalize_scheduled_time(naive) == naive)


def test_user_identity_mapping() -> None:
    print("user identity mapping")
    from models.user import User

    pk = [column.name for column in User.__table__.primary_key.columns]
    check("users primary key is the integer id column", pk == ["id"], pk)
    check(
        "user_id is unique but not the primary key",
        bool(User.__table__.c.user_id.unique) and "user_id" not in pk,
    )
    check("user_id is required", User.__table__.c.user_id.nullable is False)


async def test_http_authorization() -> None:
    print("http authorization")
    app.dependency_overrides[get_db] = _override_db
    student = _make_user("student")
    counsellor = _make_user("counsellor")
    admin = _make_user("admin")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get(f"/api/v1/stories/{uuid.uuid4()}")
        check("GET /stories/{id} requires auth", r.status_code == 401, r.status_code)
        r = await client.get("/api/v1/users/my-students")
        check("GET /users/my-students requires auth", r.status_code == 401, r.status_code)
        r = await client.post("/api/v1/ratings/", json={"counsellor_id": 1, "rating": 5})
        check("POST /ratings requires auth", r.status_code == 401, r.status_code)

        app.dependency_overrides[get_current_user] = lambda: student
        r = await client.get("/api/v1/users/my-students")
        check("students cannot list counsellor students", r.status_code == 403, r.status_code)
        r = await client.get("/api/v1/checkin/alerts")
        check("students cannot read wellness alerts", r.status_code == 403, r.status_code)
        r = await client.put("/api/v1/schedule/1", params={"status": "accepted"})
        check("students cannot update appointments", r.status_code == 403, r.status_code)

        app.dependency_overrides[get_current_user] = lambda: counsellor
        r = await client.post("/api/v1/ratings/", json={"counsellor_id": 1, "rating": 5})
        check("counsellors cannot rate", r.status_code == 403, r.status_code)
        r = await client.get("/api/v1/checkin/alerts")
        check("counsellor passes the alerts role gate", r.status_code != 403, r.status_code)
        r = await client.put("/api/v1/schedule/1", params={"status": "accepted"})
        check("counsellor passes the role gate", r.status_code != 403, r.status_code)

        app.dependency_overrides[get_current_user] = lambda: admin
        r = await client.put("/api/v1/schedule/1", params={"status": "not-a-real-status"})
        check("invalid appointment status is rejected", r.status_code == 400, r.status_code)
        r = await client.get("/api/v1/chat/sessions")
        check("admins cannot list chat sessions", r.status_code == 403, r.status_code)

        app.dependency_overrides[get_current_user] = lambda: student
        r = await client.get("/api/v1/chat/sessions")
        check("students pass the chat sessions role gate", r.status_code != 403, r.status_code)


async def test_peer_message_authorization() -> None:
    print("peer message authorization")
    from models.peer_message import ChatThread, ChatThreadTypeEnum, PeerMessage

    student = _make_user("student")
    outsider = _make_user("student")
    outsider.anon_id = "outsiderAnon001"

    thread = ChatThread(
        thread_id=uuid.uuid4(),
        thread_type=ChatThreadTypeEnum.PEER_1ON1,
        participants_anon_ids=["studentAnon001", "peerAnon001"],
    )
    other = PeerMessage(
        message_id=uuid.uuid4(),
        thread_id=thread.thread_id,
        sender_anon_id="peerAnon001",
        content="encrypted",
        flagged=False,
        moderation_status="SAFE",
    )
    own = PeerMessage(
        message_id=uuid.uuid4(),
        thread_id=thread.thread_id,
        sender_anon_id="studentAnon001",
        content="encrypted",
        flagged=False,
        moderation_status="SAFE",
    )

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        app.dependency_overrides[get_current_user] = lambda: outsider
        app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB([[other], [thread]]))
        r = await client.post(
            f"/api/v1/peer_chat/messages/{other.message_id}/report", json={"reason": "spam"}
        )
        check("non-participants cannot report a message", r.status_code == 403, r.status_code)

        app.dependency_overrides[get_current_user] = lambda: student
        app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB([[other], [thread]]))
        r = await client.post(
            f"/api/v1/peer_chat/messages/{other.message_id}/report", json={"reason": "spam"}
        )
        check("participants can report others' messages", r.status_code == 200, r.status_code)

        app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB([[own], [thread]]))
        r = await client.post(
            f"/api/v1/peer_chat/messages/{own.message_id}/report", json={"reason": "spam"}
        )
        check("users cannot report their own message", r.status_code == 400, r.status_code)

        app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB())
        r = await client.post(
            "/api/v1/peer_chat/messages/not-a-uuid/report", json={"reason": "spam"}
        )
        check("malformed message id is a clean 404", r.status_code == 404, r.status_code)

        r = await client.post(
            "/api/v1/peer_chat/messages",
            json={"thread_id": str(thread.thread_id), "content": ""},
        )
        check("empty peer messages are rejected", r.status_code == 422, r.status_code)

        counsellor = _make_user("counsellor")
        app.dependency_overrides[get_current_user] = lambda: counsellor
        app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB([[student], []]))
        r = await client.post("/api/v1/notes/", json={"student_id": 1, "text": "session note"})
        check(
            "counsellors cannot note unassigned students", r.status_code == 403, r.status_code
        )

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


async def test_rate_limit() -> None:
    print("rate limiting")
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        codes = []
        for _ in range(14):
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "a@b.com", "password": "x" * 10},
            )
            codes.append(response.status_code)
    check("login is rate limited after a burst", 429 in codes, codes)


async def test_input_validation_bounds() -> None:
    print("input validation bounds")
    student = _make_user("student")
    app.dependency_overrides[get_current_user] = lambda: student
    app.dependency_overrides[get_db] = _override_db_with(_ScriptedDB())
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/v1/checkin/", json={"q1_score": 99, "q2_score": 0})
        check("oversized PHQ-2 score rejected", r.status_code == 422, r.status_code)
        r = await client.post("/api/v1/checkin/", json={"q1_score": -1, "q2_score": 0})
        check("negative PHQ-2 score rejected", r.status_code == 422, r.status_code)
        r = await client.get("/api/v1/insights/weekly/history?limit=9999")
        check("oversized insights page rejected", r.status_code == 422, r.status_code)
        r = await client.post(
            "/api/v1/exercises/complete",
            json={"exercise_type": "box_breathing", "duration_seconds": -5},
        )
        check("negative exercise duration rejected", r.status_code == 422, r.status_code)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def main() -> int:
    test_crypto()
    test_password_and_tokens()
    test_crisis_fallback()
    test_ws_token_extraction()
    test_care_relationship_scoping()
    test_scheduled_time_normalization()
    test_user_identity_mapping()
    asyncio.run(test_http_authorization())
    asyncio.run(test_peer_message_authorization())
    asyncio.run(test_rate_limit())
    asyncio.run(test_input_validation_bounds())
    print()
    print(f"{_results['passed']} passed, {_results['failed']} failed")
    return 1 if _results["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
