"""Shared counsellor <-> student care-relationship helpers.

A student is considered "assigned" to a counsellor when they share at least one
of: an appointment request, a chat session, or a counselling session. Keeping
that definition in one place stops access-control rules from drifting between
endpoints.
"""

from sqlalchemy import or_, select

from models.chat_session import ChatSession
from models.counselling_session import CounsellingSession
from models.schedule_request import ScheduleRequest
from models.user import User


def student_belongs_to_counsellor(counsellor: User, student_id_col, student_user_id_col):
    """Boolean SQLAlchemy clause matching students under ``counsellor``.

    ``student_id_col`` is the integer ``users.id`` reference and
    ``student_user_id_col`` is the UUID ``users.user_id`` reference, matching
    the two identity keys used across the schema.
    """
    appointment_ids = select(ScheduleRequest.student_id).where(
        ScheduleRequest.counsellor_id == counsellor.id
    )
    chat_ids = select(ChatSession.student_id).where(
        ChatSession.counsellor_id == counsellor.id
    )
    session_ids = select(CounsellingSession.student_user_id).where(
        CounsellingSession.counsellor_id == counsellor.user_id
    )
    return or_(
        student_id_col.in_(appointment_ids),
        student_id_col.in_(chat_ids),
        student_user_id_col.in_(session_ids),
    )
