import sys
import os
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pydantic import BaseModel, EmailStr
from utils.email import send_verification_email

class UserModel(BaseModel):
    email: EmailStr

user = UserModel(email="bhandarisanketp@gmail.com")

success = send_verification_email(user.email, "123456")
print("Success:", success)
