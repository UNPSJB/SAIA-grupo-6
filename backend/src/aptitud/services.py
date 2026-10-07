from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    listar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.aptitud.models import Aptitud
from src.aptitud import schemas, exceptions

# `aptitudes.nombre` es UNIQUE: sin este mapeo, un PUT con un nombre repetido
# escapaba como 500 en vez de un 400 de negocio.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("aptitudes.nombre", exceptions.AptitudYaExiste),
    por_defecto=exceptions.AptitudYaExiste,
)


def crear_aptitud(db: Session, datos: schemas.AptitudCreate) -> Aptitud:
    verificar_disponibilidad(
        db,
        Aptitud,
        "nombre",
        datos.nombre,
        ya_existe=exceptions.AptitudYaExiste,
        etiqueta="aptitud",
        femenina=True,
    )

    nueva = Aptitud(**datos.model_dump())
    db.add(nueva)
    return guardar(db, nueva, _MAPEA_CONFLICTO)


def listar_aptitudes(db: Session, incluir_inactivos: bool = False) -> List[Aptitud]:
    return listar(db, Aptitud, incluir_inactivos=incluir_inactivos)


def obtener_aptitud(db: Session, aptitud_id: int) -> Aptitud:
    return obtener(db, Aptitud, aptitud_id, exceptions.AptitudNoEncontrada)


def actualizar_aptitud(db: Session, aptitud_id: int, datos: schemas.AptitudUpdate) -> Aptitud:
    aptitud = obtener_aptitud(db, aptitud_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    return aplicar_cambios(db, aptitud, cambios, _MAPEA_CONFLICTO)


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

    return baja_logica(db, aptitud)