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
from src.tareas.models import Tarea  # noqa: E402
from src.Equipo.models import Equipo  # noqa: E402
from src.PlanLimpieza.models import PlanLimpieza  # noqa: E402
from src.sector.models import Sector  # noqa: E402
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



@pytest.fixture
def db_session():
    """Sesión aislada por test para los casos de auditoría."""
    motor = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(motor, "connect")
    def _fk_on(dbapi_conexion, _):
        dbapi_conexion.execute("PRAGMA foreign_keys = ON")

    ModeloBase.metadata.create_all(motor)
    fabrica = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    db = fabrica()
    try:
        yield db
    finally:
        db.close()
        ModeloBase.metadata.drop_all(motor)
        motor.dispose()


@pytest.fixture
def sector(db_session):
    """Sector activo de prueba, aislado en la base de cada test."""
    from src.sector.models import Sector

    fila = Sector(nombre="Sector de prueba", activo=True)
    # El sector es infraestructura de la prueba, no una acción de negocio.
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(fila)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    db_session.refresh(fila)
    return fila


@pytest.fixture
def client_auditoria(client, db_session):
    """Cliente de filtros con get_db compartiendo la sesión del test."""
    from src.auth.dependencies import require_admin

    anterior_db = app.dependency_overrides.get(get_db)
    anterior_admin = app.dependency_overrides.get(require_admin)

    def _get_db_de_test():
        yield db_session

    # Estos tests prueban filtros/paginación, no autorización: el router de
    # auditoría exige admin, así que se reemplaza solo esa dependencia en esta
    # variante aislada. La sesión de negocio sigue siendo la misma del test.
    app.dependency_overrides[get_db] = _get_db_de_test
    app.dependency_overrides[require_admin] = lambda: None
    try:
        yield TestClient(app)
    finally:
        if anterior_db is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior_db
        if anterior_admin is None:
            app.dependency_overrides.pop(require_admin, None)
        else:
            app.dependency_overrides[require_admin] = anterior_admin

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


@pytest.fixture
def seed(session_factory, usuarios):
    """Checklists deterministas + el oráculo con lo que se espera de ellos.

    Scope de función (no session): cada test de paginación parte de una base
    limpia, así datos creados por otros tests (p. ej. PATCH /checklist/tarea)
    no contaminan los conteos exactos (48 checklists) que asumen estas pruebas.
    """
    from tests.seed_checklists import sembrar
    from src.checklist.models import Checklist, RegistroTarea, HistorialRegistroTarea

    with session_factory() as db:
        # Limpiar datos previos de otros tests para aislar cada prueba.
        db.info["sin_auditoria"] = True
        try:
            from sqlalchemy import text
            from src.models import ModeloBase
            db.execute(text("PRAGMA foreign_keys = OFF"))
            for table in reversed(ModeloBase.metadata.sorted_tables):
                if table.name in ("audit_log", "personal"):
                    continue  # bitácora de solo agregado; personal tiene los usuarios de prueba
                db.execute(
                    table.delete().execution_options(auditoria_omitir=True)
                )
            db.execute(text("PRAGMA foreign_keys = ON"))
            db.commit()
        finally:
            db.info.pop("sin_auditoria", None)
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
