from typing import List
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session
from src.insumos.models import Insumo
from src.insumos import schemas, exceptions


# operaciones CRUD para Insumo


def crear_insumo(db: Session, insumo: schemas.InsumoCreate) -> schemas.Insumo:

    existente = db.scalar(
        select(Insumo).where(Insumo.nombre == insumo.nombre)
    )
    if existente:
        raise exceptions.InsumoYaExiste() # no esta como criterio de aceptación explicitamente pero creemos que debería ir

    _insumo = Insumo(**insumo.model_dump())
    db.add(_insumo)
    db.commit()
    db.refresh(
        _insumo
    ) 
    return _insumo


def listar_insumos(db: Session) -> List[schemas.Insumo]:
    return db.scalars(select(Insumo)).all()


def leer_insumo(db: Session, insumo_id: int) -> schemas.Insumo:
    db_insumo = db.scalar(select(Insumo).where(Insumo.id == insumo_id))
    if db_insumo is None:
        raise exceptions.InsumoNoEncontrado() # <- usamos nuestras propias excepciones adaptadas al dominio de aplicación
    return db_insumo


def modificar_insumo(
    db: Session, insumo_id: int, insumo: schemas.InsumoUpdate
) -> Insumo:
    db_insumo = leer_insumo(db, insumo_id)
    db.execute(update(Insumo)
               .where(Insumo.id == insumo_id)
               .values(**insumo.model_dump()))
    db.commit()
    db.refresh(db_insumo)
    return db_insumo


def eliminar_insumo(db: Session, insumo_id: int) -> schemas.InsumoDelete:
    db_insumo = leer_insumo(db, insumo_id)
    db.execute(
        delete(Insumo).where(Insumo.id == insumo_id)
    )
    db.commit()
    return db_insumo
