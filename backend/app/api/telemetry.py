from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth import current_operator
from app.database import database

router = APIRouter(
    prefix="/api/drones",
    tags=["telemetry"],
    dependencies = [Depends(current_operator)],
)

@router.get("/{drone_id}/telemetry/latest")
def latest_telemetry(drone_id: int, response: Response):

    with database() as connection:
        drone = connection.execute(
            """
            SELECT id, name, type
            FROM drones
            WHERE id = ?
            """,
            (drone_id,),
        ).fetchone()

        if drone is None:
            raise HTTPException(
                status_code=404,
                detail="Drone not found",
            )

        telemetry = connection.execute(
            """
            SELECT 
                telemetry.*,
                missions.status AS mission_status
            FROM telemetry
            LEFT JOIN missions
                ON missions.id = telemetry.mission_id
            WHERE telemetry.drone_id = ?
            ORDER BY telemetry.recorded_at DESC, telemetry.id DESC
            LIMIT 1
            """,
            (drone_id,),
        ).fetchone()

        return {
            "drone":  dict(drone),
            "telemetry": dict(telemetry) if telemetry else None
        }