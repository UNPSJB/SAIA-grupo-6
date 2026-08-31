import pytest
from typing import Generator
from sqlalchemy import StaticPool, create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from src.main import app
from src.database import get_db
from src.config import settings
from src.models import ModeloBase
from src.personas.services import crear_persona
from src.mascotas.services import crear_mascota
from src.personas.schemas import PersonaCreate
from src.mascotas.schemas import MascotaCreate
from src.mascotas.models import TipoMascota


# creamos una db para testing
engine = create_engine(
    settings.DB_URL_TEST,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    # utilizaremos esta funcion para "pisar" la que definimos en src/database.py.
    db = TestingSessionLocal()
    # Para usar restricciones de FK en SQLite, debemos habilitar la siguiente opción:
    db.execute(text("PRAGMA foreign_keys = ON"))
    try:
        print("Using test DB!")
        yield db
    finally:
        db.close()

# forzamos a fastapi para que utilice la db para testing.
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def session() -> Generator[Session, None, None]:
    # Creamos las tablas en la db de pruebas
    ModeloBase.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    # Para usar restricciones de FK en SQLite, debemos habilitar la siguiente opción:
    db.execute(text("PRAGMA foreign_keys = ON"))

    # aqui podemos crear instancias de objetos para hacer tests
    # haciendo uso de las funciones "create_<clase>" de services y los schemas <Clase>Create.
    persona_1 = crear_persona(db, PersonaCreate(nombre="Juan", email="juan.perez@gmail.com"))
    persona_2 = crear_persona(
        db, PersonaCreate(nombre="Ana", email="ana.dominguez@gmail.com")
    )
    mascota_1 = crear_mascota(db, MascotaCreate(nombre="Lola", tipo=TipoMascota.GATO, tutor_id=persona_1.id))
    mascota_2 = crear_mascota(db, MascotaCreate(nombre="Felipe", tipo=TipoMascota.PERRO, tutor_id=persona_1.id))
    mascota_3 = crear_mascota(db, MascotaCreate(nombre="Coco", tipo=TipoMascota.COBAYO, tutor_id=persona_2.id))

    db.add_all(
        [
            persona_1,
            persona_2,
            mascota_1,
            mascota_2,
            mascota_3
        ]
    )
    db.commit()

    yield db

    db.close()
    ModeloBase.metadata.drop_all(bind=engine)
