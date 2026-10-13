import sqlite3
from contextlib import asynccontextmanager


from fastapi import FastAPI

from app.config import settings

from app.auth import router as auth_router
from app.database import initialize_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    settings.logs_directory.mkdir(parents=True, exist_ok=True)  
    yield



app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)
app.include_router(auth_router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "mode": settings.mode,

    }
