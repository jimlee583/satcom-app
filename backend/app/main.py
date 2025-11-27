from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import example, rf  # 👈 add rf here

app = FastAPI(
    title="Satcom App API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing example router
app.include_router(example.router, prefix="/api")

# New RF router
app.include_router(rf.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok"}

