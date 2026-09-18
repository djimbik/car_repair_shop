from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SERVICEFLOW_", env_file=".env")

    database_url: str = "sqlite:///./data/serviceflow.db"
    seed_demo: bool = True


settings = Settings()
