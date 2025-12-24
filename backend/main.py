from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def check_health() : 
    return {"msg" : "Health Perfect!"}