from fastapi import FastAPI
from app.routers import example

app = FastAPI()

app.include_router(example.router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}
