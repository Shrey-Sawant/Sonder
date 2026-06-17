"""Add anonymous ID system, journals, peer chat, sessions, insights, stories, crisis

Revision ID: add_anon_and_features
Revises: ea101648f72a
Create Date: 2026-06-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_anon_and_features'
down_revision: Union[str, Sequence[str], None] = 'ea101648f72a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # ===== PHASE 1: Update users table with UUID primary key and new fields =====
    # First, add new columns to existing users table
    op.add_column('users', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True, server_default=sa.text('gen_random_uuid()')))
    op.create_unique_constraint('uq_users_user_id', 'users', ['user_id'])
    op.add_column('users', sa.Column('anon_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('anon_id_created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True))
    op.add_column('users', sa.Column('anon_mode_enabled', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column('users', sa.Column('verified_counsellor', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('users', sa.Column('real_name', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('notify_on_crisis', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
    
    # Create unique index on anon_id
    op.create_unique_constraint('uq_users_anon_id', 'users', ['anon_id'])
    op.create_index(op.f('ix_users_anon_id'), 'users', ['anon_id'], unique=False)
    
    # Update experience column to be Float instead of Integer
    op.alter_column('users', 'experience', existing_type=sa.Integer(), type_=sa.Float(), nullable=True)
    
    # ===== PHASE 2: Create journal_entries table =====
    op.execute("DROP TABLE IF EXISTS journal_entries CASCADE")
    op.create_table('journal_entries',
    sa.Column('entry_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('anon_id', sa.String(), nullable=False),
    sa.Column('mood_selected', sa.Enum('calm', 'anxious', 'sad', 'frustrated', 'hopeful', 'numb', 'grateful', 'overwhelmed', name='moodenum'), nullable=False),
    sa.Column('prompt_category', sa.Enum('academic', 'social', 'identity', 'general', name='promptcategoryenum'), nullable=False),
    sa.Column('entry_text', sa.Text(), nullable=False),
    sa.Column('ai_reflection', sa.Text(), nullable=True),
    sa.Column('shared_anonymously', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], name=op.f('fk_journal_entries_user_id')),
    sa.PrimaryKeyConstraint('entry_id', name=op.f('pk_journal_entries'))
    )
    op.create_index(op.f('ix_journal_entries_user_id'), 'journal_entries', ['user_id'], unique=False)
    op.create_index(op.f('ix_journal_entries_anon_id'), 'journal_entries', ['anon_id'], unique=False)
    
    # ===== PHASE 3: Create chat_threads table =====
    op.create_table('chat_threads',
    sa.Column('thread_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('thread_type', sa.Enum('peer_1on1', 'support_circle', name='chatthreadtypeenum'), nullable=False),
    sa.Column('participants_anon_ids', postgresql.ARRAY(sa.String()), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('last_message_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('thread_id', name=op.f('pk_chat_threads'))
    )
    
    # ===== PHASE 4: Create peer_messages table =====
    op.create_table('peer_messages',
    sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('thread_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('sender_anon_id', sa.String(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('flagged', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('flag_reason', sa.String(), nullable=True),
    sa.Column('sent_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['thread_id'], ['chat_threads.thread_id'], name=op.f('fk_peer_messages_thread_id')),
    sa.PrimaryKeyConstraint('message_id', name=op.f('pk_peer_messages'))
    )
    op.create_index(op.f('ix_peer_messages_thread_id'), 'peer_messages', ['thread_id'], unique=False)
    op.create_index(op.f('ix_peer_messages_sender_anon_id'), 'peer_messages', ['sender_anon_id'], unique=False)
    
    # ===== PHASE 5: Create counselling_sessions table =====
    op.create_table('counselling_sessions',
    sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('student_anon_id', sa.String(), nullable=False),
    sa.Column('student_user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('counsellor_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('room_url', sa.String(), nullable=True),
    sa.Column('room_token', sa.String(), nullable=True),
    sa.Column('scheduled_at', sa.DateTime(), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=False),
    sa.Column('anon_mode', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('session_notes_encrypted', sa.Text(), nullable=True),
    sa.Column('recording_enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('recording_url', sa.String(), nullable=True),
    sa.Column('status', sa.Enum('scheduled', 'ongoing', 'completed', 'cancelled', 'no_show', name='sessionstatusenum'), server_default='scheduled', nullable=False),
    sa.Column('started_at', sa.DateTime(), nullable=True),
    sa.Column('ended_at', sa.DateTime(), nullable=True),
    sa.Column('mood_check_sent', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('mood_check_response', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['student_user_id'], ['users.user_id'], name=op.f('fk_counselling_sessions_student')),
    sa.ForeignKeyConstraint(['counsellor_id'], ['users.user_id'], name=op.f('fk_counselling_sessions_counsellor')),
    sa.PrimaryKeyConstraint('session_id', name=op.f('pk_counselling_sessions'))
    )
    op.create_index(op.f('ix_counselling_sessions_student_anon_id'), 'counselling_sessions', ['student_anon_id'], unique=False)
    op.create_index(op.f('ix_counselling_sessions_student_user_id'), 'counselling_sessions', ['student_user_id'], unique=False)
    op.create_index(op.f('ix_counselling_sessions_scheduled_at'), 'counselling_sessions', ['scheduled_at'], unique=False)
    op.create_index(op.f('ix_counselling_sessions_status'), 'counselling_sessions', ['status'], unique=False)
    
    # ===== PHASE 6: Create weekly_insights table =====
    op.create_table('weekly_insights',
    sa.Column('insight_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('week_start', sa.Date(), nullable=False),
    sa.Column('observation', sa.Text(), nullable=False),
    sa.Column('reframe', sa.Text(), nullable=False),
    sa.Column('micro_action', sa.Text(), nullable=False),
    sa.Column('mood_frequency_data', sa.Text(), nullable=True),
    sa.Column('trigger_categories', sa.Text(), nullable=True),
    sa.Column('time_of_day_pattern', sa.String(), nullable=True),
    sa.Column('positive_streaks', sa.Text(), nullable=True),
    sa.Column('viewed', sa.Boolean(), server_default=sa.false(), nullable=False),
    sa.Column('viewed_at', sa.DateTime(), nullable=True),
    sa.Column('generated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], name=op.f('fk_weekly_insights_user_id')),
    sa.PrimaryKeyConstraint('insight_id', name=op.f('pk_weekly_insights'))
    )
    op.create_index(op.f('ix_weekly_insights_user_id'), 'weekly_insights', ['user_id'], unique=False)
    op.create_index(op.f('ix_weekly_insights_week_start'), 'weekly_insights', ['week_start'], unique=False)
    
    # ===== PHASE 7: Create shared_stories table =====
    op.create_table('shared_stories',
    sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('journal_entry_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('author_anon_id', sa.String(), nullable=False),
    sa.Column('excerpt', sa.Text(), nullable=False),
    sa.Column('mood', sa.String(), nullable=False),
    sa.Column('full_entry_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('resonance_count', sa.Integer(), server_default=sa.literal(0), nullable=False),
    sa.Column('moderated', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('moderation_notes', sa.String(), nullable=True),
    sa.Column('active', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('published_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.entry_id'], name=op.f('fk_shared_stories_journal_entry')),
    sa.PrimaryKeyConstraint('story_id', name=op.f('pk_shared_stories')),
    sa.UniqueConstraint('journal_entry_id', name=op.f('uq_shared_stories_journal_entry'))
    )
    op.create_index(op.f('ix_shared_stories_author_anon_id'), 'shared_stories', ['author_anon_id'], unique=False)
    
    # ===== PHASE 8: Create crisis_events table =====
    op.create_table('crisis_events',
    sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('anon_id', sa.String(), nullable=False),
    sa.Column('source', sa.Enum('journal', 'chat', 'mood_streak', name='crisissourceenum'), nullable=False),
    sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('risk_level', sa.Enum('low', 'medium', 'high', name='risklevel'), nullable=False),
    sa.Column('signal_text', sa.Text(), nullable=True),
    sa.Column('ai_reasoning', sa.Text(), nullable=True),
    sa.Column('intervention_shown', sa.String(), nullable=True),
    sa.Column('user_took_action', sa.String(), nullable=True),
    sa.Column('counsellor_notified', sa.String(), nullable=True),
    sa.Column('counsellor_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('follow_up_sent', sa.String(), nullable=True),
    sa.Column('resolved', sa.String(), nullable=True),
    sa.Column('triggered_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], name=op.f('fk_crisis_events_user_id')),
    sa.ForeignKeyConstraint(['counsellor_id'], ['users.user_id'], name=op.f('fk_crisis_events_counsellor_id')),
    sa.PrimaryKeyConstraint('event_id', name=op.f('pk_crisis_events'))
    )
    op.create_index(op.f('ix_crisis_events_user_id'), 'crisis_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_crisis_events_anon_id'), 'crisis_events', ['anon_id'], unique=False)
    op.create_index(op.f('ix_crisis_events_risk_level'), 'crisis_events', ['risk_level'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    
    # Drop tables in reverse order
    op.drop_table('crisis_events')
    op.drop_table('shared_stories')
    op.drop_table('weekly_insights')
    op.drop_table('counselling_sessions')
    op.drop_table('peer_messages')
    op.drop_table('chat_threads')
    op.drop_table('journal_entries')
    
    # Drop new columns from users table
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'notify_on_crisis')
    op.drop_column('users', 'real_name')
    op.drop_column('users', 'verified_counsellor')
    op.drop_column('users', 'anon_mode_enabled')
    op.drop_column('users', 'anon_id_created_at')
    op.drop_column('users', 'anon_id')
    op.drop_column('users', 'user_id')
    
    # Revert experience column type
    op.alter_column('users', 'experience', existing_type=sa.Float(), type_=sa.Integer(), nullable=True)
