from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from config.settings import settings


app = FastAPI()

@app.get("/")
def check_health() : 
    return {"msg" : settings.DB_NAME}