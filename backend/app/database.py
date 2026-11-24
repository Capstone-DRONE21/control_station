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

             -- 6 drones: 1 physical, 5 simulated
            CREATE TABLE IF NOT EXISTS drones (
                id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
                name TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL CHECK (type IN ('physical', 'simulated')),
                connection_url TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            
            CREATE TABLE IF NOT EXISTS charging_pad (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                latitude REAL CHECK (latitude BETWEEN -90 AND 90),
                longitude REAL CHECK (longitude BETWEEN -180 AND 180),
                altitude_m REAL,
                status TEXT NOT NULL DEFAULT 'free'
                    CHECK (status IN ('free', 'reserved', 'occupied', 'charging', 'fault')),
                occupied_by_drone_id INTEGER UNIQUE,
                comm_status TEXT NOT NULL DEFAULT 'lost'
                    CHECK (comm_status IN ('connected', 'lost')),
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (occupied_by_drone_id)
                    REFERENCES drones (id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS missions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drone_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'active', 'completed', 'aborted')),
                started_at TEXT,
                ended_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (drone_id)
                    REFERENCES drones (id) ON DELETE CASCADE
            );

            -- Only one active mission per drone
            CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_mission
                ON missions (drone_id) WHERE status = 'active';

            -- Telemetry for all 6 drones
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drone_id INTEGER NOT NULL,
                mission_id INTEGER,
                recorded_at TEXT NOT NULL
                    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                state TEXT NOT NULL CHECK (state IN (
                    'idle', 'taking_off', 'on_mission', 'returning_to_base',
                    'waiting_for_pad', 'landing', 'charging', 'offline', 'fault')),
                comm_status TEXT NOT NULL DEFAULT 'connected'
                    CHECK (comm_status IN ('connected', 'lost')),
                battery_soc_percent REAL
                    CHECK (battery_soc_percent BETWEEN 0 AND 100),
                battery_soh_percent REAL
                    CHECK (battery_soh_percent BETWEEN 0 AND 100),

                --  physical GPS
                latitude REAL CHECK (latitude BETWEEN -90 AND 90),
                longitude REAL CHECK (longitude BETWEEN -180 AND 180),

                -- Simulated, metres relative to the charging pad
                pos_x_m REAL,
                pos_y_m REAL,
                pos_z_m REAL,

                altitude_m REAL,
                speed_mps REAL,
                vel_x_mps REAL,
                vel_y_mps REAL,
                vel_z_mps REAL,
                acc_x_mps2 REAL,
                acc_y_mps2 REAL,
                acc_z_mps2 REAL,

                CHECK (
                    (latitude IS NOT NULL AND longitude IS NOT NULL)
                    OR (pos_x_m IS NOT NULL AND pos_y_m IS NOT NULL AND pos_z_m IS NOT NULL)
                ),

                FOREIGN KEY (drone_id)
                    REFERENCES drones (id) ON DELETE CASCADE,
                FOREIGN KEY (mission_id)
                    REFERENCES missions (id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_telemetry_drone_time
                ON telemetry (drone_id, recorded_at);

            CREATE TABLE IF NOT EXISTS video_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mission_id INTEGER NOT NULL,
                frame_index INTEGER NOT NULL
                    CHECK (frame_index >= 0),
                elapsed_ms REAL NOT NULL
                    CHECK (elapsed_ms >= 0),
                recorded_at TEXT NOT NULL,

                --relative to the recording path: probably backend/data/...
                image_path TEXT NOT NULL,
                width INTEGER NOT NULL CHECK (width > 0),
                height INTEGER NOT NULL CHECK (height > 0),
                UNIQUE (mission_id, frame_index),
                FOREIGN KEY (mission_id)
                    REFERENCES missions (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_video_frames_mission_time
                ON video_frames (mission_id, recorded_at);

            CREATE INDEX IF NOT EXISTS idx_telemetry_mission_time
                ON telemetry (mission_id, recorded_at);
        """)

        connection.execute("INSERT OR IGNORE INTO charging_pad (id) VALUES (1)")

        # TODO:ports and communication urls to be configured later
        connection.executemany(
            """
            INSERT OR IGNORE INTO drones (id, name, type, connection_url)
            VALUES (?, ?, ?, ?)
            """,
            [(1, "Drone 1", "physical", "serial:///dev/ttyUSB0")]
            + [
                (i, f"Drone {i}", "simulated", f"udpin://127.0.0.1:{14540 + i - 2}")
                for i in range(2, 7)
            ],
        )