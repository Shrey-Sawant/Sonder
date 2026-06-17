"""merge heads

Revision ID: 80c429a1cce0
Revises: add_anon_and_features, b1c2d3e4f5g6
Create Date: 2026-06-17 21:21:39.450597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80c429a1cce0'
down_revision: Union[str, Sequence[str], None] = ('add_anon_and_features', 'b1c2d3e4f5g6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
