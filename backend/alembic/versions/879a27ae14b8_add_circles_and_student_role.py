"""add circles and student role

Revision ID: 879a27ae14b8
Revises: 80c429a1cce0
Create Date: 2026-06-21 17:43:05.040517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '879a27ae14b8'
down_revision: Union[str, Sequence[str], None] = '80c429a1cce0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### custom upgrade for Sonder Support Circles ###
    op.create_table('circles',
    sa.Column('circle_id', sa.UUID(), nullable=False),
    sa.Column('thread_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('tagline', sa.String(), nullable=False),
    sa.Column('welcome_message', sa.Text(), nullable=False),
    sa.Column('rules', sa.JSON(), nullable=False),
    sa.Column('opening_prompt', sa.Text(), nullable=False),
    sa.Column('sensitivity_level', sa.String(), nullable=False),
    sa.Column('crisis_keywords', sa.JSON(), nullable=False),
    sa.Column('theme', sa.String(), nullable=False),
    sa.Column('type', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['thread_id'], ['chat_threads.thread_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('circle_id'),
    sa.UniqueConstraint('thread_id')
    )
    op.create_index(op.f('ix_circles_name'), 'circles', ['name'], unique=True)
    
    # Add student_role to users table
    op.add_column('users', sa.Column('student_role', sa.String(), nullable=True))
    
    # Add moderation details to peer_messages table
    op.add_column('peer_messages', sa.Column('moderation_status', sa.String(), nullable=False, server_default='SAFE'))
    op.add_column('peer_messages', sa.Column('moderation_reason', sa.String(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### custom downgrade for Sonder Support Circles ###
    op.drop_column('peer_messages', 'moderation_reason')
    op.drop_column('peer_messages', 'moderation_status')
    op.drop_column('users', 'student_role')
    op.drop_index(op.f('ix_circles_name'), table_name='circles')
    op.drop_table('circles')
    # ### end Alembic commands ###
    # ### end Alembic commands ###
