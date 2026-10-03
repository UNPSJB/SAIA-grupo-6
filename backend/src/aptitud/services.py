from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.exceptions import ConflictoRegistroInactivo
from src.aptitud.models import Aptitud
from src.aptitud import schemas, exceptions


def crear_aptitud(db: Session, datos: schemas.AptitudCreate) -> Aptitud:
    existente = db.scalar(select(Aptitud).where(Aptitud.nombre == datos.nombre))
    if existente:
        if existente.activo:
            raise exceptions.AptitudYaExiste()
        raise ConflictoRegistroInactivo(
            mensaje=f"La aptitud '{existente.nombre}' ya existe pero está dada de baja. ¿Querés reactivarla con estos nuevos datos?",
            entidad_id=existente.id,
            campo="nombre",
        )

    nueva = Aptitud(**datos.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


def listar_aptitudes(db: Session, incluir_inactivos: bool = False) -> List[Aptitud]:
    consulta = select(Aptitud).order_by(Aptitud.id)
    if not incluir_inactivos:
        consulta = consulta.where(Aptitud.activo == True)
    return list(db.scalars(consulta).all())


def obtener_aptitud(db: Session, aptitud_id: int) -> Aptitud:
    aptitud = db.scalar(select(Aptitud).where(Aptitud.id == aptitud_id))
    if not aptitud:
        raise exceptions.AptitudNoEncontrada()
    return aptitud


def actualizar_aptitud(db: Session, aptitud_id: int, datos: schemas.AptitudUpdate) -> Aptitud:
    aptitud = obtener_aptitud(db, aptitud_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    for clave, valor in cambios.items():
        setattr(aptitud, clave, valor)

    db.commit()
    db.refresh(aptitud)
    return aptitud


def eliminar_aptitud(db: Session, aptitud_id: int) -> Aptitud:
    # Import diferido para evitar import circular: vencimientoPersonal
    # va a depender de aptitud (FK), así que aptitud no puede importarlo
    # a nivel de módulo.
    from src.vencimientoPersonal.models import VencimientoPersonal

    aptitud = obtener_aptitud(db, aptitud_id)

    vencimiento_en_uso = db.scalar(
        select(VencimientoPersonal).where(
            VencimientoPersonal.aptitud_id == aptitud_id,
            VencimientoPersonal.activo == True,
        )
    )
    if vencimiento_en_uso:
        raise exceptions.AptitudEnUso(
            mensaje=f"La aptitud '{aptitud.nombre}' está en uso por un vencimiento de personal activo."
        )

    aptitud.activo = False
    db.commit()
    db.refresh(aptitud)
    return aptitud