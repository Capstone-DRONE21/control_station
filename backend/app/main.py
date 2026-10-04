import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.database_file.parent.mkdir(parents=True, exist_ok=True)
    settings.logs_directory.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(settings.database_file) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                source TEXT NOT NULL,
                message TEXT NOT NULL
            )
        """)

    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "mode": settings.mode,
    }
