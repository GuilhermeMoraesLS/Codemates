from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # LLM
    openai_api_key: str

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # GitHub OAuth
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str = "http://localhost:3000/api/auth/callback"

    # App
    server_secret_key: str = "codemates-dev-secret"
    next_public_api_url: str = "http://localhost:8000"

    class Config:
        env_file = "../../../.env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
