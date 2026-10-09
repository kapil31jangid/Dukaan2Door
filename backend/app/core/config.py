from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Dukaan2Door API"
    API_V1_STR: str = "/api"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/dukaan2door"
    JWT_SECRET_KEY: str = "change_me_super_secret_key_for_dev_only_1234567890_dukaan2door"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    CORS_ORIGINS: Union[str, List[str]] = ["*"]
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    PADDLE_OCR_DETECTION_MODEL: str = "PP-OCRv6_small_det"
    PADDLE_OCR_RECOGNITION_MODEL: str = "PP-OCRv6_medium_rec"
    PADDLE_OCR_CPU_THREADS: int = 4
    PADDLE_OCR_MAX_IMAGE_SIDE: int = 1600
    PADDLE_OCR_MAX_IMAGE_PIXELS: int = 25_000_000
    PADDLE_OCR_MAX_PDF_PAGES: int = 10
    PADDLE_OCR_LOW_CONFIDENCE: float = 0.70
    PADDLE_OCR_COMPARE_PREPROCESSED: bool = False
    PADDLE_OCR_USE_ORIENTATION: bool = False

    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Use the PostgreSQL driver installed by this project for provider URLs."""
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
