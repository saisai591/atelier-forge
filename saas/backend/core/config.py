from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://forge:forge@db/forge_saas"
    REDIS_URL: str = "redis://redis:6379"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Nom du NOYAU (neutre, multi-métier). Le branding métier vit au niveau tenant.
    APP_NAME: str = "Forge Platform"
    DEBUG: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
