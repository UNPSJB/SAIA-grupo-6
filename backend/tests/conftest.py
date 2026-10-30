import os

# Debe ocurrir antes de importar módulos de src, que construyen el engine al
# cargarse. sqlite:// conserva una única base temporal por hilo para cada test.
os.environ.setdefault("DB_URL", "sqlite://")
os.environ.setdefault("DB_URL_TEST", "sqlite://")
os.environ.setdefault("SECRET_KEY", "clave-de-prueba-de-stock-con-mas-de-32-caracteres")

import pytest

import src.all_models  # noqa: F401
from src.database import SessionLocal, engine
from src.models import ModeloBase


@pytest.fixture
def db():
    ModeloBase.metadata.drop_all(bind=engine)
    ModeloBase.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        ModeloBase.metadata.drop_all(bind=engine)
