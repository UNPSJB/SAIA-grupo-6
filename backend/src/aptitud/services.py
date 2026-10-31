from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.common.texto import sin_tildes
from src.aptitud.models import Aptitud
from src.aptitud import schemas, exceptions

# `aptitudes.nombre` es UNIQUE: sin este mapeo, un PUT con un nombre repetido
# escapaba como 500 en vez de un 400 de negocio.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("aptitudes.nombre", exceptions.AptitudYaExiste),
    por_defecto=exceptions.AptitudYaExiste,
)

# Claves del query string -> expresión de orden. `descripcion` es opcional:
# los NULL van al final para que no encabecen una lista ascendente.
_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Aptitud.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Aptitud.nombre),), descendente=True),
    "descripcion_asc": ColumnaOrden(
        (sin_tildes(Aptitud.descripcion),), nulos_al_final=True
    ),
    "descripcion_desc": ColumnaOrden(
        (sin_tildes(Aptitud.descripcion),),
        descendente=True,
        nulos_al_final=True,
    ),
}


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


def _consulta_aptitudes(
    incluir_inactivos: bool, buscar: Optional[str]
):
    """Consulta base compartida por el listado completo y el paginado."""
    consulta = select(Aptitud)

    filtro = filtro_busqueda((Aptitud.nombre, Aptitud.descripcion), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)

    if not incluir_inactivos:
        consulta = consulta.where(Aptitud.activo.is_(True))

    return consulta


def listar_aptitudes(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> List[Aptitud]:
    consulta = _consulta_aptitudes(incluir_inactivos, buscar).order_by(Aptitud.id)
    return list(db.scalars(consulta).all())


def listar_aptitudes_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    orden: str = "nombre_asc",
) -> tuple[List[Aptitud], int]:
    """Mismo filtro que `listar_aptitudes`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_aptitudes(incluir_inactivos, buscar),
        modelo=Aptitud,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


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