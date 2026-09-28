from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.deps import get_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Set up CORS middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Serve uploaded product images as static files at /uploads/products/<filename>
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include API Router under /api
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health Check"])
def health_check(db: Session = Depends(get_db)):
    """Service health check endpoint for Render and other web service hosts."""
    db_status = "unhealthy"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "database": db_status,
    }


@app.get("/", tags=["Root"])
def root():
    """Root landing endpoint redirecting to documentation."""
    return {
        "message": "Welcome to Dukaan2Door Backend API",
        "docs": "/docs",
        "health": "/health",
    }
