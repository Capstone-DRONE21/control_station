from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIRECTORY / ".env",
        env_prefix="CS_",
        extra="forbid",
    )

    app_name: str = "Control Station"
    mode: Literal["mock", "simulation", "hardware"] = "mock"
    log_level: str = "INFO"

    database_path: Path = Path("data/control_station.db")
    log_directory: Path = Path("logs")

    frontend_origin: str = "http://127.0.0.1:5173" 
    cookie_secure:bool = False
    

    drone_serial_port: str = ""
    drone_baud_rate: int = 57600
    simulated_drone_url: str = "udpin://127.0.0.1:14540"

    pad_serial_port: str = ""
    pad_baud_rate: int = 115200

    scheduler_url: str = "http://127.0.0.1:8001"
    command_timeout_seconds: float = 3
    stale_telemetry_seconds: float = 2

    @property
    def database_file(self) -> Path:
        return BACKEND_DIRECTORY / self.database_path

    @property
    def logs_directory(self) -> Path:
        return BACKEND_DIRECTORY / self.log_directory


settings = Settings()