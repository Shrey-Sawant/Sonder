from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

from models.user import User