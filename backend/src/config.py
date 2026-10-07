from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Raiz del backend (este archivo vive en backend/src/config.py). Anclar aca
# evita que la configuracion dependa del directorio desde el que se arrancó.
RAIZ_BACKEND = Path(__file__).resolve().parent.parent
ARCHIVO_ENV = RAIZ_BACKEND / ".env"
CARPETA_UPLOADS = RAIZ_BACKEND / "uploads"

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

    @field_validator("DB_URL")
    @classmethod
    def anclar_sqlite(cls, v: str) -> str:
        """Convierte a absoluta la ruta de una base SQLite relativa.

        `sqlite:///db.sqlite3` es una ruta RELATIVA, y SQLite la resuelve
        contra el directorio del proceso, no contra el lugar del `.env`. Eso
        significa que arrancar el server desde la raíz del repo en lugar de
        desde `backend/` crea y usa OTRA base: una vacía en la raíz y la real
        acá adentro. Es exactamente lo que había pasado, y explica por qué
        existían dos archivos `.sqlite3`.

        Se deja intacto lo que ya es absoluto, y también `sqlite://` (base en
        memoria, usada por los tests) y los esquemas de servidor.
        """
        if not v.startswith("sqlite"):
            return v

        # sqlite://  -> memoria, sin archivo
        # sqlite://:memory: -> memoria
        # sqlite:///relativo -> hay que anclarlo
        try:
            from sqlalchemy.engine import make_url

            ruta = make_url(v).database
        except Exception:
            return v

        if not ruta or ruta == ":memory:" or ruta.startswith(":memory:"):
            return v

        if Path(ruta).is_absolute():
            return v

        return f"sqlite:///{(RAIZ_BACKEND / ruta).as_posix()}"

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

    # Configuración para que lea automáticamente el archivo .env.
    # Ruta absoluta: si fuera relativo, dependería del CWD del proceso.
    model_config = SettingsConfigDict(
        env_file=str(ARCHIVO_ENV),
        env_file_encoding="utf-8",
        extra="ignore",  # Ignora otras variables que estén en el .env y no definamos en este archivo
    )


# Instancia global que reutilizaremos en el proyecto
settings = Settings()
