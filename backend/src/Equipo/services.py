from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
    obtener,
)
from src.common.texto import normalizar_texto, sin_tildes

from . import exceptions, schemas
from .exceptions import EquipoNoEncontrado
from .models import Equipo
from .schemas import EquipoCreate, EquipoUpdate

# `equipos.nombre` es UNIQUE: antes un PUT con nombre repetido escapaba como 500.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("equipos.nombre", exceptions.NombreDuplicado),
    por_defecto=exceptions.NombreDuplicado,
)

# Claves del query string -> expresión de orden. Las columnas de texto pasan
# por `sin_tildes` para que "Ácido" quede junto a "Acido" y no después de "Z".
_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Equipo.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Equipo.nombre),), descendente=True),
    "tipo_asc": ColumnaOrden((sin_tildes(Equipo.tipo),)),
    "tipo_desc": ColumnaOrden((sin_tildes(Equipo.tipo),), descendente=True),
    "ubicacion_asc": ColumnaOrden((sin_tildes(Equipo.ubicacion),)),
    "ubicacion_desc": ColumnaOrden(
        (sin_tildes(Equipo.ubicacion),), descendente=True
    ),
}


def _consulta_equipos(
    incluir_inactivos: bool,
    buscar: Optional[str],
    tipo: Optional[str],
    ubicacion: Optional[str],
):
    """Consulta base compartida por el listado completo y el paginado.

    Los dropdowns llaman sin filtros: el resultado sigue siendo la lista de
    siempre ordenada por id.
    """
    consulta = select(Equipo)

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (Equipo.nombre, Equipo.tipo, Equipo.ubicacion), buscar
            ),
            Equipo.tipo == tipo if tipo else None,
            Equipo.ubicacion == ubicacion if ubicacion else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if not incluir_inactivos:
        consulta = consulta.where(Equipo.activo.is_(True))

    return consulta


def crear_equipo(db: Session, datos: EquipoCreate) -> Equipo:
    nuevo_equipo = Equipo(**datos.model_dump())
    db.add(nuevo_equipo)
    return guardar(db, nuevo_equipo, _MAPEA_CONFLICTO)


def listar_equipos(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    tipo: Optional[str] = None,
    ubicacion: Optional[str] = None,
) -> list[Equipo]:
    consulta = _consulta_equipos(
        incluir_inactivos, buscar, tipo, ubicacion
    ).order_by(Equipo.id)
    return list(db.scalars(consulta).all())


def listar_equipos_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    tipo: Optional[str] = None,
    ubicacion: Optional[str] = None,
    orden: str = "nombre_asc",
) -> tuple[list[Equipo], int]:
    """Mismo filtro que `listar_equipos`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_equipos(incluir_inactivos, buscar, tipo, ubicacion),
        modelo=Equipo,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def obtener_opciones_equipos(db: Session) -> schemas.EquipoOpcionesResponse:
    """Tipos y ubicaciones que existen hoy, para los selects de filtro.

    Se ordenan en Python con la misma normalización que la búsqueda: hacerlo
    en SQL con `DISTINCT` + `sin_tildes` obliga a repetir la expresión en el
    `ORDER BY` y no aporta nada sobre un catálogo chico.
    """

    def valores_distintos(columna) -> list[str]:
        valores = db.scalars(
            select(columna).where(Equipo.activo.is_(True)).distinct()
        ).all()
        return sorted(
            {valor for valor in valores if valor},
            key=normalizar_texto,
        )

    return schemas.EquipoOpcionesResponse(
        tipos=valores_distintos(Equipo.tipo),
        ubicaciones=valores_distintos(Equipo.ubicacion),
    )


def obtener_equipo(db: Session, equipo_id: int) -> Equipo:
    return obtener(db, Equipo, equipo_id, lambda: EquipoNoEncontrado(equipo_id))


def actualizar_equipo(
    db: Session, equipo_id: int, datos: EquipoUpdate
) -> Equipo:
    equipo = obtener_equipo(db, equipo_id)

    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    return aplicar_cambios(db, equipo, cambios, _MAPEA_CONFLICTO)


def dar_de_baja_equipo(db: Session, equipo_id: int) -> Equipo:
    return baja_logica(db, obtener_equipo(db, equipo_id))
