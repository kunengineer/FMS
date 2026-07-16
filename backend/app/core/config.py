import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Fleet Manager System"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = "supersecretkeychangeinproduction12345"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    DATABASE_URL: str = (
        "postgresql://postgres:Kien04112004!@db:5432/fleet_db"
        if os.path.exists("/.dockerenv") or os.getenv("DOCKER_ENV")
        else "postgresql://postgres:Kien04112004!@localhost:5432/fleet_db"
    )
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    
    class Config:
        case_sensitive = True

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
