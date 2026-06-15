"""add video meeting url to schedule requests

Revision ID: b1c2d3e4f5g6
Revises: ea101648f72a
Create Date: 2026-06-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, Sequence[str], None] = 'ea101648f72a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('schedule_requests', sa.Column('video_meeting_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('schedule_requests', 'video_meeting_url')
