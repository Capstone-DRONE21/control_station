import sqlite3
from contextlib import asynccontextmanager


from fastapi import FastAPI

from app.config import settings

from app.auth import router as auth_router
from app.database import initialize_database

from app.api.telemetry import router as telemetry_router
from app.api.frames import router as frames_router
from app.api.live import router as live_router

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
app.include_router(telemetry_router)
app.include_router(frames_router)
app.include_router(live_router)
