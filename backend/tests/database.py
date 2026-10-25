# tests/database.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from src.auth.dependencies import require_admin, require_operador   # NUEVO
from src.config import settings
from src.models import Base
from src.database import get_db
from src.main import app
from src.Equipo.models import Equipo

# Motor de base de datos en memoria para testing
engine = create_engine(
    settings.DB_URL_TEST,  # DB_URL_TEST="sqlite://" en el archivo .env
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Sobrescribe la dependencia get_db para usar la base de datos en memoria."""
    def override_get_db():
        yield db_session            # CAMBIO: sin close(), lo cierra el fixture db_session

    app.dependency_overrides[get_db] = override_get_db
    # NUEVO: saltear la autenticación (los endpoints exigen sesión)
    app.dependency_overrides[require_admin] = lambda: object()
    app.dependency_overrides[require_operador] = lambda: object()

    c = TestClient(app)             # CAMBIO: sin "with" (ver explicación abajo)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def db_session():
    """Crea las tablas antes de cada test y las destruye al finalizar."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def unico_equipo(db_session):
    """Inserta un equipo de prueba en la BD y lo retorna para usarlo en los tests."""
    equipo = Equipo(
        nombre="Heladera-01",
        tipo="Refrigeración",       # NUEVO: obligatorio en tu modelo
        ubicacion="Cocina",         # NUEVO: obligatorio en tu modelo
        activo=True,
    )
    db_session.add(equipo)
    db_session.commit()
    db_session.refresh(equipo)
    return equipo


@pytest.fixture
def multiples_equipos(db_session):
    """Inserta varios equipos para probar listados."""
    equipos = [
        Equipo(nombre="Cocina-01", tipo="Horno", ubicacion="Cocina", activo=True),             # CAMBIO: name -> nombre
        Equipo(nombre="Heladera-02", tipo="Refrigeración", ubicacion="Depósito", activo=False),
        Equipo(nombre="Freezer-01", tipo="Refrigeración", ubicacion="Depósito", activo=True),
    ]
    db_session.add_all(equipos)
    db_session.commit()
    return equipos