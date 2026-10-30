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
from src.sector.models import Sector
from src.sector import schemas, exceptions

_MAPEA_CONFLICTO = mapa_por_campo(
    ("sectores.nombre", exceptions.SectorYaExiste),
    por_defecto=exceptions.SectorYaExiste,
)

# Claves del query string -> expresión de orden. `descripcion` es opcional:
# los NULL van al final para que no encabecen una lista ascendente.
_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Sector.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Sector.nombre),), descendente=True),
    "descripcion_asc": ColumnaOrden(
        (sin_tildes(Sector.descripcion),), nulos_al_final=True
    ),
    "descripcion_desc": ColumnaOrden(
        (sin_tildes(Sector.descripcion),),
        descendente=True,
        nulos_al_final=True,
    ),
}


def crear_sector(db: Session, datos: schemas.SectorCreate) -> Sector:
    verificar_disponibilidad(
        db,
        Sector,
        "nombre",
        datos.nombre,
        ya_existe=exceptions.SectorYaExiste,
        etiqueta="sector",
    )

    nuevo = Sector(**datos.model_dump())
    db.add(nuevo)
    return guardar(db, nuevo, _MAPEA_CONFLICTO)


def _consulta_sectores(
    incluir_inactivos: bool, buscar: Optional[str]
):
    """Consulta base compartida por el listado completo y el paginado."""
    consulta = select(Sector)

    filtro = filtro_busqueda((Sector.nombre, Sector.descripcion), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)

    if not incluir_inactivos:
        consulta = consulta.where(Sector.activo.is_(True))

    return consulta


def listar_sectores(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> List[Sector]:
    consulta = _consulta_sectores(incluir_inactivos, buscar).order_by(Sector.id)
    return list(db.scalars(consulta).all())


def listar_sectores_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    orden: str = "nombre_asc",
) -> tuple[List[Sector], int]:
    """Mismo filtro que `listar_sectores`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_sectores(incluir_inactivos, buscar),
        modelo=Sector,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def obtener_sector(db: Session, sector_id: int) -> Sector:
    return obtener(db, Sector, sector_id, exceptions.SectorNoEncontrado)


def actualizar_sector(db: Session, sector_id: int, datos: schemas.SectorUpdate) -> Sector:
    sector = obtener_sector(db, sector_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    return aplicar_cambios(db, sector, cambios, _MAPEA_CONFLICTO)


def eliminar_sector(db: Session, sector_id: int) -> Sector:
    # Import diferido para evitar un import circular (Equipo depende de Sector).
    from src.Equipo.models import Equipo

    sector = obtener_sector(db, sector_id)

    equipo_en_uso = db.scalar(
        select(Equipo).where(
            Equipo.sector_id == sector_id,
            Equipo.activo == True,
        )
    )
    if equipo_en_uso:
        raise exceptions.SectorEnUso(
            mensaje=f"El sector '{sector.nombre}' está en uso por un equipo activo."
        )

    return baja_logica(db, sector)