from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.auth import current_operator
from app.config import settings
from app.database import database

router = APIRouter(
    prefix="/api/frames",
    tags=["frames"],
    dependencies=[Depends(current_operator)],
)

@router.get("/{frame_id}/image")
def get_frame_image(frame_id: int):

    with database() as connection:
        frame = connection.execute(
            """
            SELECT image_path
            FROM video_frames
            WHERE id = ?
            """,
            (frame_id,),
        ).fetchone()

        if frame is None:
            raise HTTPException(
                status_code=404,
                detail="Frame not found",
            )

        recordings_folder = settings.recordings_directory.resolve()
        image_path = (recordings_folder / frame["image_path"]).resolve()

        if not image_path.is_relative_to(recordings_folder):
            raise HTTPException(
                status_code=403,
                detail="Invalid image path"
            )

        if not image_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="Image file not found",
            )

        return FileResponse(
            image_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store"}
        )
