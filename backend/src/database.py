from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.common import texto as _texto  # noqa: F401  (registra `sin_tildes` en SQLite)
from src.config import settings


_engine_kwargs = {"connect_args": {"check_same_thread": False}}
# Los tests usan sqlite:// en memoria. StaticPool mantiene una sola conexión
# compartida entre el worker de TestClient y el hilo del test.
if settings.DB_URL == "sqlite://":
    _engine_kwargs["poolclass"] = StaticPool

engine = create_engine(settings.DB_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    # Para usar restricciones de FK en SQLite, debemos habilitar la siguiente opción:
    db.execute(text("PRAGMA foreign_keys = ON"))
    try:
        yield db
    finally:
        db.close()
