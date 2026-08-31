from typing import List
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session
from src.mascotas.models import Mascota
from src.mascotas import schemas, exceptions


# operaciones CRUD para Mascota


def crear_mascota(db: Session, mascota: schemas.MascotaCreate) -> schemas.Mascota:
    _mascota = Mascota(**mascota.model_dump())
    db.add(_mascota)
    db.commit()
    db.refresh(
        _mascota
    )  # <- qué hace refresh()?: https://docs.sqlalchemy.org/en/21/orm/session_api.html#sqlalchemy.orm.Session.refresh
    return _mascota


def listar_mascotas(db: Session) -> List[schemas.Mascota]:
    return db.scalars(select(Mascota)).all()


def leer_mascota(db: Session, mascota_id: int) -> schemas.Mascota:
    db_mascota = db.scalar(select(Mascota).where(Mascota.id == mascota_id))
    if db_mascota is None:
        raise exceptions.MascotaNoEncontrada() # <- usamos nuestras propias excepciones adaptadas al dominio de aplicación
    return db_mascota


def modificar_mascota(
    db: Session, mascota_id: int, mascota: schemas.MascotaUpdate
) -> Mascota:
    db_mascota = leer_mascota(db, mascota_id)
    db.execute(update(Mascota)
               .where(Mascota.id == mascota_id)
               .values(**mascota.model_dump()))
    db.commit()
    db.refresh(db_mascota)
    return db_mascota


def eliminar_mascota(db: Session, mascota_id: int) -> schemas.MascotaDelete:
    db_mascota = leer_mascota(db, mascota_id)
    db.execute(
        delete(Mascota).where(Mascota.id == mascota_id)
    )
    db.commit()
    return db_mascota
