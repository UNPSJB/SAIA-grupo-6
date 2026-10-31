"""Configuración compartida de los tests.

Regla de oro: estos tests NUNCA tocan `db.sqlite3`. Las variables de entorno
se fuerzan ANTES de importar `src`, porque `src.config` lee el entorno al
importarse (las variables de entorno tienen prioridad sobre el `.env`).

Además se crea un motor propio con `StaticPool`: una base SQLite en memoria
vive en UNA conexión, y TestClient ejecuta los endpoints síncronos en otro
hilo. Sin StaticPool cada hilo vería su propia base vacía.
"""

import os

os.environ["DB_URL"] = "sqlite://"
os.environ["DB_URL_TEST"] = "sqlite://"
os.environ["SECRET_KEY"] = "clave-solo-para-tests-" + "x" * 32

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import src.all_models  # noqa: E402,F401  (registro completo de modelos)
from src.auth.services import crear_access_token  # noqa: E402
from src.database import SessionLocal, engine as app_engine, get_db  # noqa: E402
from src.main import app  # noqa: E402
from src.models import ModeloBase  # noqa: E402
from src.personal.models import Personal  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    motor = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(motor, "connect")
    def _fk_on(dbapi_conexion, _):
        dbapi_conexion.execute("PRAGMA foreign_keys = ON")

    ModeloBase.metadata.create_all(motor)
    yield motor
    motor.dispose()


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def client(session_factory):
    """TestClient sin `with`: no corre el lifespan (que migraría la base real)."""

    def _get_db_de_test():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db_de_test
    yield TestClient(app)
    app.dependency_overrides.clear()


def _headers(personal_id: int) -> dict:
    token, _, _ = crear_access_token(str(personal_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def usuarios(session_factory):
    """Un admin y un operador sin permiso de administrar."""
    with session_factory() as db:
        admin = Personal(
            nombre="Ada", apellido="Admin", dni="10000001",
            email="admin@test.local", password="x",
            puede_administrar=True, puede_operar=True,
        )
        operador = Personal(
            nombre="Omar", apellido="Operador", dni="10000002",
            email="operador@test.local", password="x",
            puede_administrar=False, puede_operar=True,
        )
        db.add_all([admin, operador])
        db.commit()
        return {
            "admin": _headers(admin.id),
            "operador": _headers(operador.id),
            "admin_id": admin.id,
        }


@pytest.fixture(scope="session")
def H_ADMIN(usuarios):
    return usuarios["admin"]


@pytest.fixture(scope="session")
def seed(session_factory, usuarios):
    """Checklists deterministas + el oráculo con lo que se espera de ellos."""
    from tests.seed_checklists import sembrar

    with session_factory() as db:
        return sembrar(db, usuarios["admin_id"])


@pytest.fixture
def db():
    """Base aislada para los tests de stock que administran su propio cliente.

    Es independiente del motor compartido de los tests de paginación de dev,
    por lo que el alta/baja de tablas de una prueba no puede contaminar a otra.
    """
    ModeloBase.metadata.drop_all(bind=app_engine)
    ModeloBase.metadata.create_all(bind=app_engine)
    session = SessionLocal()
    session.execute(text("PRAGMA foreign_keys = ON"))
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        ModeloBase.metadata.drop_all(bind=app_engine)
