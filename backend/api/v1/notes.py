from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.session import get_db
from models.session_note import SessionNote
from models.user import User
from schemas.session_note import SessionNoteCreate, SessionNoteResponse
from api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=list[SessionNoteResponse])
async def get_notes(
    student_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = select(SessionNote).where(SessionNote.counsellor_id == current_user.id)
    if student_id is not None:
        stmt = stmt.where(SessionNote.student_id == student_id)
        
    stmt = stmt.order_by(desc(SessionNote.created_at))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/", response_model=SessionNoteResponse, status_code=201)
async def create_note(
    note: SessionNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    s_res = await db.execute(select(User).where(User.id == note.student_id, User.role == "student"))
    student = s_res.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student user not found")
        
    new_note = SessionNote(
        counsellor_id=current_user.id,
        student_id=note.student_id,
        text=note.text
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)
    return new_note


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["counsellor", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    res = await db.execute(
        select(SessionNote)
        .where(SessionNote.id == note_id, SessionNote.counsellor_id == current_user.id)
    )
    note = res.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Session note not found")
        
    await db.delete(note)
    await db.commit()
    return {"message": "Session note deleted"}
