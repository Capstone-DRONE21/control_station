
import csv
import math
from pathlib import Path

import time
from datetime import datetime, timedelta, timezone
from app.database import database, initialize_database

current_script_path = Path(__file__).resolve()
backend_folder = current_script_path.parents[2]
recordings_folder = (
    backend_folder
    / "data"
    / "demo_recordings"
    / "mission-1-043c02ac-9fd6-43ed-809f-b39c43ca3a7a"
)

telemetry_file = recordings_folder/"telemetry.csv"
frames_file = recordings_folder/"frames.csv"

def read_csv(path):
    rows = []

    with open(path, mode="r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            rows.append(row)
    return rows

COLUMNS = [
    "battery_soc_percent",
    "battery_soh_percent",
    "latitude",
    "longitude",
    "pos_x_m",
    "pos_y_m",
    "pos_z_m",
    "altitude_m",
    "speed_mps",
    "vel_x_mps",
    "vel_y_mps",
    "vel_z_mps",
    "acc_x_mps2",
    "acc_y_mps2",
    "acc_z_mps2",
]
    
def fill_with_null(value):
    if value is None or value.strip() == "":
        return None

    return float(value)

def format_timestamp(value):
    return value.isoformat(timespec="milliseconds").replace("+00:00","Z")

def insert_telemetry(connection, row, drone_id, mission_id, recorded_at):

    measurements = []

    for column in COLUMNS:
        measurements.append(fill_with_null(row[column]))

    connection.execute(
        """
            INSERT INTO telemetry (
            drone_id,
            mission_id,
            recorded_at,
            state,
            comm_status,
            battery_soc_percent,
            battery_soh_percent,
            latitude,
            longitude,
            pos_x_m,
            pos_y_m,
            pos_z_m,
            altitude_m,
            speed_mps,
            vel_x_mps,
            vel_y_mps,
            vel_z_mps,
            acc_x_mps2,
            acc_y_mps2,
            acc_z_mps2
        )
        VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
        """,
        [
            drone_id,
            mission_id,
            recorded_at,
            row["state"],
            row["comm_status"],
            *measurements,
        ]
    )

def insert_frames(connection, row, mission_id, started_at):
    elapsed_ms = float(row["elapsed_ms"])

    frame_time = started_at + timedelta(milliseconds=elapsed_ms)

    connection.execute(
        """
        INSERT INTO video_frames (
            mission_id,
            frame_index,
            elapsed_ms,
            recorded_at,
            image_path,
            width,
            height
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mission_id,
            int(row["frame_index"]),
            elapsed_ms,
            format_timestamp(frame_time),
            row["image_path"],
            int(row["width"]),
            int(row["height"]),
        ),
    )

def delete_demo_mission(mission_id):
    with database() as connection:
        
        connection.execute(
            "DELETE FROM video_frames WHERE mission_id = ?",
            (mission_id,),
        )

        connection.execute(
            "DELETE FROM telemetry WHERE mission_id = ?",
            (mission_id,),
        )

        connection.execute(
            "DELETE FROM missions WHERE id = ?",
            (mission_id,),
        )

def create_replay_events(telemetry_rows, frames_rows):
    events = []

    # Telemetry is replayed at two samples per second.
    for sample_number, row in enumerate(telemetry_rows):
        events.append((sample_number * 0.5, "telemetry", row))

    # Each frame has its own deadline, independent of telemetry.
    for row in frames_rows:
        elapsed_seconds = float(row["elapsed_ms"]) / 1000
        if elapsed_seconds < 0 or not math.isfinite(elapsed_seconds):
            raise ValueError("Frame elapsed_ms must be finite and non-negative")
        events.append((elapsed_seconds, "frame", row))

    events.sort(key=lambda event: event[0])
    return events


def main():
    telemetry_rows = read_csv(telemetry_file)
    frames_rows = read_csv(frames_file)

    if not telemetry_rows:
        print("No telemetry to replay.")
        return

    telemetry_rows.sort(key=lambda row: row["recorded_at"])
    events = create_replay_events(telemetry_rows, frames_rows)
    drone_id = 2

    initialize_database()

    with database() as connection:
        started_at = datetime.now(timezone.utc)
        replay_clock = time.monotonic()

        cursor = connection.execute(
            """
            INSERT INTO missions (
                drone_id, name, description, status, started_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                drone_id,
                "Mission D1",
                "The first demo mission",
                "active",
                format_timestamp(started_at),
            ),
        )
        mission_id = cursor.lastrowid

    print(f"Started mission {mission_id}, for drone {drone_id}")
    frames_inserted = 0

    try:
        for elapsed_seconds, event_type, row in events:
            # Absolute deadlines prevent database work from adding drift.
            wait_seconds = replay_clock + elapsed_seconds - time.monotonic()
            if wait_seconds > 0:
                time.sleep(wait_seconds)

            # Commit each event before waiting for the next one, so readers
            # can see frames as they arrive rather than in half-second batches.
            with database() as connection:
                if event_type == "telemetry":
                    sample_time = started_at + timedelta(seconds=elapsed_seconds)
                    insert_telemetry(
                        connection, row, drone_id, mission_id,
                        format_timestamp(sample_time),
                    )
                else:
                    insert_frames(connection, row, mission_id, started_at)
                    frames_inserted += 1

            if event_type == "telemetry":
                print(
                    f"{elapsed_seconds:5.1f}s | "
                    f"State: {row['state']} | "
                    f"SOC: {row['battery_soc_percent']}% | "
                    f"Frames inserted: {frames_inserted}"
                )

        ended_at = started_at + timedelta(seconds=events[-1][0])
        with database() as connection:
            connection.execute(
                """
                UPDATE missions
                SET status = 'completed', ended_at = ?
                WHERE id = ?
                """,
                (format_timestamp(ended_at), mission_id),
            )

        print(f"Mission {mission_id} completed. Frames inserted: {frames_inserted}")

    except (Exception, KeyboardInterrupt):
        with database() as connection:
            connection.execute(
                """
                UPDATE missions
                SET status = 'aborted', ended_at = ?
                WHERE id = ?
                """,
                (format_timestamp(datetime.now(timezone.utc)), mission_id),
            )
        raise




if __name__ == "__main__":
    main()
