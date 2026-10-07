import logging

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LONGITUD_MINIMA_SECRET_KEY = 32
SECRET_KEY_DE_EJEMPLO = "cambiar-en-produccion"


class Settings(BaseSettings):
    # Definimos las variables con sus tipos y valores por defecto (opcional)
    DB_URL: str
    DB_URL_TEST: str
    ENV: str = "DEVELOPMENT"
    ROOT_PATH_DEVELOPMENT: str = ""
    ROOT_PATH_PRODUCTION: str = ""
    LOG_LEVEL: str = "INFO"

    # Seguridad JWT: sin valor por defecto a propósito. Si falta en el .env,
    # la aplicación no arranca (fail fast) en lugar de firmar tokens con una
    # clave conocida.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Máximo de intentos fallidos de login por combinación IP + DNI.
    LOGIN_MAX_INTENTOS: int = 5
    LOGIN_VENTANA_MINUTOS: int = 5
   

    # Orígenes permitidos por CORS, separados por coma.
    # Para probar desde el celular hay que agregar la IP de la red local,
    # por ejemplo: "http://localhost:5173,http://192.168.0.10:5173"
    CORS_ORIGINS: str = "http://localhost:5173"

    @field_validator("SECRET_KEY")
    @classmethod
    def validar_secret_key(cls, v: str) -> str:
        if len(v.strip()) < LONGITUD_MINIMA_SECRET_KEY:
            raise ValueError(
                f"SECRET_KEY debe tener al menos {LONGITUD_MINIMA_SECRET_KEY} caracteres. "
                "Generá una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )

        if v.strip() == SECRET_KEY_DE_EJEMPLO:
            raise ValueError(
                "SECRET_KEY sigue con el valor de ejemplo. Definí una clave propia en el .env."
            )

        return v

    @property
    def cors_origins(self) -> list[str]:
        return [origen.strip() for origen in self.CORS_ORIGINS.split(",") if origen.strip()]

    # Configuración para que lea automáticamente el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignora otras variables que estén en el .env y no definamos en este archivo
    )


# Instancia global que reutilizaremos en el proyecto
settings = Settings()
