"""
Configuration management for Smart Digital Campus Network GNS3 FastAPI Backend.
Loads settings from environment variables and .env file.
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file from backend directory or project root
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


class Settings(BaseSettings):
    # GNS3 Server Configuration
    # Note: GNS3 server URL (do not confuse with website port 3080)
    GNS3_SERVER_URL: str = os.getenv("GNS3_SERVER_URL", "http://localhost:3080")
    GNS3_API_VERSION: str = os.getenv("GNS3_API_VERSION", "v2")
    GNS3_USER: Optional[str] = os.getenv("GNS3_USER", None)
    GNS3_PASSWORD: Optional[str] = os.getenv("GNS3_PASSWORD", None)
    GNS3_PROJECT_ID: Optional[str] = os.getenv("GNS3_PROJECT_ID", None)
    GNS3_PROJECT_NAME: Optional[str] = os.getenv("GNS3_PROJECT_NAME", "SmartCampus_Full")
    GNS3_TIMEOUT_SECONDS: float = float(os.getenv("GNS3_TIMEOUT_SECONDS", "4.0"))

    # Server Configuration
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3080",
        "http://127.0.0.1:3080",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        "*"
    ]

    @property
    def gns3_base_api_url(self) -> str:
        """Returns the full normalized GNS3 base API endpoint."""
        url = self.GNS3_SERVER_URL.rstrip('/')
        if not url.endswith(f"/{self.GNS3_API_VERSION}"):
            url = f"{url}/{self.GNS3_API_VERSION}"
        return url

    class Config:
        case_sensitive = True
        extra = "ignore"


settings = Settings()
