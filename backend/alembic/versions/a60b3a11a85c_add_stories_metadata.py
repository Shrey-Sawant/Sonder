"""add_stories_metadata

Revision ID: a60b3a11a85c
Revises: 879a27ae14b8
Create Date: 2026-06-21 17:54:02.713106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a60b3a11a85c'
down_revision: Union[str, Sequence[str], None] = '879a27ae14b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('shared_stories', sa.Column('theme', sa.String(), nullable=True))
    op.add_column('shared_stories', sa.Column('resonance_hook', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('shared_stories', 'resonance_hook')
    op.drop_column('shared_stories', 'theme')
