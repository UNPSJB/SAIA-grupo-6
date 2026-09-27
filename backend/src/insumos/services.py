import logging
from typing import List
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.exceptions import ConflictoRegistroInactivo
from src.insumos.models import Insumo
from src.insumos import schemas, exceptions

logger = logging.getLogger(__name__)


def crear_insumo(db: Session, insumo: schemas.InsumoCreate) -> Insumo:
    existente = db.scalar(
        select(Insumo).where(Insumo.nombre == insumo.nombre)
    )
    if existente:
        if existente.activo:
            raise exceptions.InsumoYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"El insumo '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
                entidad_id=existente.id,
                campo="nombre"
            )
    _insumo = Insumo(**insumo.model_dump())
    db.add(_insumo)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(_insumo)
    return _insumo


def listar_insumos(db: Session, incluir_inactivos: bool = False) -> List[Insumo]:
    consulta = select(Insumo).order_by(Insumo.id)
    if not incluir_inactivos:
        consulta = consulta.where(Insumo.activo == True)
    return list(db.scalars(consulta).all())


def leer_insumo(db: Session, insumo_id: int) -> Insumo:
    db_insumo = db.scalar(select(Insumo).where(Insumo.id == insumo_id))
    if db_insumo is None:
        raise exceptions.InsumoNoEncontrado()
    return db_insumo


def modificar_insumo(
    db: Session, insumo_id: int, insumo: schemas.InsumoUpdate
) -> Insumo:
    db_insumo = leer_insumo(db, insumo_id)

    # Solo actualizamos los campos que realmente vinieron en el request
    # (evita pisar 'activo' u otros campos con NULL cuando no se envían).
    datos_a_actualizar = insumo.model_dump(exclude_unset=True)

    if datos_a_actualizar:
        try:
            db.execute(
                update(Insumo)
                .where(Insumo.id == insumo_id)
                .values(**datos_a_actualizar)
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise exceptions.InsumoYaExiste()
        except Exception:
            db.rollback()
            raise
        db.refresh(db_insumo)

    return db_insumo


def eliminar_insumo(db: Session, insumo_id: int) -> Insumo:
    db_insumo = leer_insumo(db, insumo_id)
    db_insumo.activo = False
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(db_insumo)
    return db_insumo