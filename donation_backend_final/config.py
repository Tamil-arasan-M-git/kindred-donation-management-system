import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/donation_platform")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "change-this-secret-in-production"
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
CORS_ALLOWED_ORIGINS = [value.strip() for value in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if value.strip()]
USE_CUSTOM_MODEL = os.getenv("USE_CUSTOM_MODEL", "false").lower() == "true"
CUSTOM_MODEL_PATH = os.getenv("CUSTOM_MODEL_PATH", "runs/detect/donation_items_yolov8n/weights/best.pt")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))