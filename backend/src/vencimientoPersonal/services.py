from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.personal.models import Personal
from src.aptitud.models import Aptitud
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vencimientoPersonal import schemas, exceptions


def _obtener_persona_o_error(db: Session, persona_id: int) -> Personal:
    persona = db.scalar(select(Personal).where(Personal.id == persona_id))
    if not persona:
        raise exceptions.PersonaNoEncontrada()
    return persona


def _obtener_aptitud_o_error(db: Session, aptitud_id: int) -> Aptitud:
    aptitud = db.scalar(
        select(Aptitud).where(Aptitud.id == aptitud_id, Aptitud.activo == True)
    )
    if not aptitud:
        raise exceptions.AptitudNoEncontrada()
    return aptitud


def crear_vencimiento(
    db: Session, datos: schemas.VencimientoPersonalCreate
) -> VencimientoPersonal:
    _obtener_persona_o_error(db, datos.persona_id)
    _obtener_aptitud_o_error(db, datos.aptitud_id)

    existente = db.scalar(
        select(VencimientoPersonal).where(
            VencimientoPersonal.persona_id == datos.persona_id,
            VencimientoPersonal.aptitud_id == datos.aptitud_id,
        )
    )

    if existente and existente.activo:
        raise exceptions.AptitudDuplicada()

    if existente and not existente.activo:
        # Ya existía (estaba dado de baja) -> lo reactivamos en vez de
        # violar el UniqueConstraint insertando uno nuevo.
        existente.activo = True
        existente.fecha_vencimiento = datos.fecha_vencimiento
        db.commit()
        db.refresh(existente)
        return existente

    nuevo = VencimientoPersonal(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def listar_vencimientos_de_persona(
    db: Session, persona_id: int
) -> List[VencimientoPersonal]:
    _obtener_persona_o_error(db, persona_id)
    consulta = (
        select(VencimientoPersonal)
        .where(
            VencimientoPersonal.persona_id == persona_id,
            VencimientoPersonal.activo.is_(True),
        )
        .order_by(VencimientoPersonal.aptitud_id)
    )
    return list(db.scalars(consulta).all())


def obtener_vencimiento(db: Session, vencimiento_id: int) -> VencimientoPersonal:
    vencimiento = db.scalar(
        select(VencimientoPersonal).where(VencimientoPersonal.id == vencimiento_id)
    )
    if not vencimiento:
        raise exceptions.VencimientoNoEncontrado()
    return vencimiento


def actualizar_vencimiento(
    db: Session, vencimiento_id: int, datos: schemas.VencimientoPersonalUpdate
) -> VencimientoPersonal:
    vencimiento = obtener_vencimiento(db, vencimiento_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    for clave, valor in cambios.items():
        setattr(vencimiento, clave, valor)

    db.commit()
    db.refresh(vencimiento)
    return vencimiento


def eliminar_vencimiento(db: Session, vencimiento_id: int) -> None:
    vencimiento = obtener_vencimiento(db, vencimiento_id)
    vencimiento.activo = False
    db.commit()