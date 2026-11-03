"""Motor y fixtures de base de datos para tests unitarios.

Nunca toca `db.sqlite3`: usa SQLite en memoria (`sqlite://`) con
`StaticPool` y `check_same_thread=False`, igual que en producción, pero
aislado para cada test.

Los fixtures de datos (`unico_<entidad>`, `multiples_<entidades>`) usan
`session.info["sin_auditoria"] = True` al sembrar para no escribir en
`audit_log` (son datos de infraestructura, no acciones de negocio).
"""

import os

os.environ.setdefault("DB_URL", "sqlite://")
os.environ.setdefault("DB_URL_TEST", "sqlite://")
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-para-tests-solo-xyz1234567890")

import pytest  # noqa: E402
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import src.all_models  # noqa: E402,F401  (registro completo de modelos)
from src.common import texto as _texto  # noqa: F401  (registra `sin_tildes`)
from src.config import settings  # noqa: E402  (ya valida SECRET_KEY)
from src.database import SessionLocal  # noqa: F401  (usa engine de tests por el env)
from src.models import ModeloBase  # noqa: E402


def _crear_motor():
    motor = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(motor, "connect")
    def _fk_on(dbapi_conexion, _):
        dbapi_conexion.execute("PRAGMA foreign_keys = ON")

    return motor


@pytest.fixture(scope="function")
def db_session():
    """Sesión aislada por test: crea tablas antes, drop_all + close al salir."""
    motor = _crear_motor()
    ModeloBase.metadata.create_all(motor)
    fabrica = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    db = fabrica()
    try:
        yield db
    finally:
        db.close()
        ModeloBase.metadata.drop_all(motor)
        motor.dispose()


def _sembrar(db: Session, filas, sin_auditoria: bool = True):
    """Agrega filas, commit y refresh cada una. Opcionalmente silencia auditoría."""
    if sin_auditoria:
        db.info["sin_auditoria"] = True
    try:
        for fila in filas:
            db.add(fila)
            db.commit()
            db.refresh(fila)
    finally:
        if sin_auditoria:
            db.info.pop("sin_auditoria", None)
    return filas
