import sqlite3
from contextlib import contextmanager

from app.config import settings

@contextmanager
def database():
    connection = sqlite3.connect(settings.database_file)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()      

def initialize_database():
    settings.database_file.parent.mkdir(parents=True, exist_ok=True)
    with database() as connection:
        connection.executescript("""

            CREATE TABLE IF NOT EXISTS operators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                operator_id INTEGER NOT NULL,
                FOREIGN KEY (operator_id) 
                    REFERENCES operators (id) ON DELETE CASCADE
            );
"""
                                 )
