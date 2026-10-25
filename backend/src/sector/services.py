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
from src.sector.models import Sector
from src.sector import schemas, exceptions

_MAPEA_CONFLICTO = mapa_por_campo(
    ("sectores.nombre", exceptions.SectorYaExiste),
    por_defecto=exceptions.SectorYaExiste,
)


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


def listar_sectores(db: Session, incluir_inactivos: bool = False) -> List[Sector]:
    return listar(db, Sector, incluir_inactivos=incluir_inactivos)


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