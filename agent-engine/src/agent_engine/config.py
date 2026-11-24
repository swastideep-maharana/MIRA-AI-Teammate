import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

class Settings(BaseModel):
    gemini_api_key: str = Field(..., min_length=10)
    database_url: str = Field(..., min_length=10)
    primary_model: str = os.getenv("GEMINI_PRIMARY_MODEL", "gemini-3.5-flash-lite")
    fallback_model: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
    embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    langfuse_public_key: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    langfuse_secret_key: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    langfuse_host: str = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

def get_settings() -> Settings:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("CRITICAL: GEMINI_API_KEY is missing from environment variables.")
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("CRITICAL: DATABASE_URL is missing from environment variables.")
    return Settings(gemini_api_key=api_key, database_url=db_url)

settings = get_settings()