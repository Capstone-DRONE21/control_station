import asyncio
import time

from fastapi import (
    APIRouter,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)

from app.auth import current_operator
from app.config import settings
from app.database import database

router = APIRouter(
    prefix = "/api/ws",
    tags=["live"],
)

def read_updates(drone_id, previous_mission_id, last_frame_id):
    with database() as connection:
        drone = connection.execute(
            "SELECT id FROM drones WHERE id = ?",
            (drone_id,),
        ).fetchone()

        if drone is None:
            return None

        mission = connection.execute(
            """
            SELECT id, status, started_at, ended_at
            FROM missions
            WHERE drone_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (drone_id,),
        ).fetchone()

        if mission is None:
            return {
                "mission": None,
                "telemetry": None,
                "frames": [],
            }

        mission_id = mission["id"]

        telemetry = connection.execute(
            """
            SELECT * 
            FROM telemetry 
            WHERE drone_id = ? AND mission_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (drone_id, mission_id),
        ).fetchone()

        if mission_id != previous_mission_id:
            frames = connection.execute(
                """
                SELECT id, mission_id, frame_index, elapsed_ms, recorded_at
                FROM video_frames
                WHERE mission_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (mission_id,),
            ).fetchall()

        else:
            frames = connection.execute(
                """
                SELECT id, mission_id, frame_index, elapsed_ms, recorded_at
                FROM video_frames
                WHERE mission_id = ? AND id > ?
                ORDER BY id
                LIMIT 120
                """,
                (mission_id, last_frame_id),
            ).fetchall()

    return{
        "mission": dict(mission),
        "telemetry": dict(telemetry) if telemetry else None,
        "frames": [dict(frame) for frame in frames],
    }

async def wait_for_disconnect(websocket: WebSocket):
    """Return once the client disconnects or the server shuts down."""
    while True:
        message = await websocket.receive()
        if message["type"] == "websocket.disconnect":
            return


@router.websocket("/drones/{drone_id}")
async def drone_live(websocket: WebSocket, drone_id: int):
    if websocket.headers.get("origin") != settings.frontend_origin:
        await websocket.close(code=1008)
        return

    try:
        await asyncio.to_thread(current_operator, websocket)
    except HTTPException:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    # The loop below only sends, so on its own it never notices a closed
    # socket while there is nothing new to send. Watch for the disconnect
    # (client gone or server shutting down) so the handler always ends.
    disconnected = asyncio.create_task(wait_for_disconnect(websocket))

    previous_mission_id = None
    previous_mission_state = None
    last_telemetry_id = None
    last_frame_id = 0
    next_auth_check = time.monotonic() +5

    try:
        while not disconnected.done():
            if time.monotonic() >= next_auth_check:
                try:
                    await asyncio.to_thread(
                        current_operator,
                        websocket,
                    )
                except HTTPException:
                    await websocket.close(code=1008)
                    return

                next_auth_check = time.monotonic() +5

            updates = await asyncio.to_thread(
                read_updates,
                drone_id,
                previous_mission_id,
                last_frame_id,
            )

            if updates is None:
                await websocket.send_json({
                    "type": "error",
                    "message": "Drone not found",
                })
                await websocket.close(code=1008)
                return

            mission = updates["mission"]
            mission_id = mission["id"] if mission else None

            if mission_id != previous_mission_id:
                last_frame_id = 0
                last_telemetry_id = None

            mission_state = (
                mission_id,
                mission["status"] if mission else None,
            )

            if mission_state != previous_mission_state:
                await websocket.send_json({
                    "type": "mission",
                    "data": mission,
                })

                previous_mission_state = mission_state

            telemetry = updates["telemetry"]

            if telemetry and telemetry["id"] != last_telemetry_id:
                await websocket.send_json({
                    "type": "telemetry",
                    "data": telemetry,
                })

                last_telemetry_id = telemetry["id"]

            for frame in updates["frames"]:
                frame["image_url"] = (
                    f"/api/frames/{frame['id']}/image"
                )

                await websocket.send_json({
                    "type": "frame",
                    "data": frame,
                })

                last_frame_id = frame["id"]

            previous_mission_id = mission_id

            
            await asyncio.sleep(0.02)

    except (WebSocketDisconnect, OSError):
        return
    finally:
        disconnected.cancel()
