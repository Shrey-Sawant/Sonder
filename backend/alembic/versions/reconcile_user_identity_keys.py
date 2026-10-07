"""Reconcile user identity keys (user_id / anon_id NOT NULL)

The live ``users`` table keeps the integer ``id`` as its primary key (the
appointment / chat / note foreign keys all reference it) and uses ``user_id``
as a unique UUID surrogate.  Both ``user_id`` and ``anon_id`` were originally
added as nullable columns for compatibility with pre-existing rows, so this
migration backfills them and enforces NOT NULL to match the ORM.  The primary
key is intentionally left on ``id``; swapping it would break every foreign key
that references ``users.id``.

Revision ID: c3a7f1d92b40
Revises: a60b3a11a85c
Create Date: 2026-10-06 00:00:00.000000

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3a7f1d92b40"
down_revision: Union[str, Sequence[str], None] = "a60b3a11a85c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Inlined (rather than imported from utils.anon_id) so this data migration
# keeps working even if the application's generator changes later.
_ADJECTIVES = [
    "calm", "quiet", "bold", "gentle", "still",
    "soft", "bright", "clear", "open", "warm",
]
_NOUNS = [
    "river", "moon", "echo", "forest", "wave",
    "peak", "cloud", "ember", "tide", "stone",
]


def _generate_anon_id(rng) -> str:
    adjective = rng.choice(_ADJECTIVES)
    noun = rng.choice(_NOUNS)
    number = str(rng.randrange(1000)).zfill(3)
    return f"{adjective}{noun[0].upper()}{noun[1:]}{number}"


def upgrade() -> None:
    """Backfill and constrain the user identity columns."""
    bind = op.get_bind()
    uuid_type = postgresql.UUID(as_uuid=True)

    # 1. user_id: new rows already default to gen_random_uuid(); give any
    #    legacy NULL a value before enforcing NOT NULL so ORM identity lookups
    #    can never collide on (None).
    bind.execute(text("UPDATE users SET user_id = gen_random_uuid() WHERE user_id IS NULL"))
    op.alter_column("users", "user_id", existing_type=uuid_type, nullable=False)

    # 2. anon_id: rows created before the anonymous-identity feature have no
    #    value. Generate unique ones, then enforce NOT NULL.
    rng = secrets.SystemRandom()
    taken = {
        row[0]
        for row in bind.execute(text("SELECT anon_id FROM users WHERE anon_id IS NOT NULL"))
        if row[0]
    }
    for (user_pk,) in bind.execute(text("SELECT id FROM users WHERE anon_id IS NULL")):
        while True:
            candidate = _generate_anon_id(rng)
            if candidate not in taken:
                break
        taken.add(candidate)
        bind.execute(
            text("UPDATE users SET anon_id = :anon_id WHERE id = :user_pk"),
            {"anon_id": candidate, "user_pk": user_pk},
        )
    op.alter_column("users", "anon_id", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    """Relax the columns back to nullable."""
    op.alter_column("users", "anon_id", existing_type=sa.String(), nullable=True)
    op.alter_column(
        "users", "user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True
    )
