import logging

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Definimos las variables con sus tipos y valores por defecto (opcional)
    DB_URL: str
    DB_URL_TEST: str
    ENV: str = "DEV"
    ROOT_PATH_DEVELOPMENT: str = ""
    ROOT_PATH_PRODUCTION: str = ""
    LOG_LEVEL: str = "INFO"

    # Configuración para que lea automáticamente el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignora otras variables que estén en el .env y no definamos en este archivo
    )


# Instancia global que reutilizaremos en el proyecto
settings = Settings()
