"""Listados que respaldan la exportación de tablas.

Las pantallas filtran con el servicio de su módulo (búsqueda en varias
columnas o en tablas relacionadas, rol, estado calculado, orden...). Acá cada
tabla exportable se asocia a ese mismo servicio, así el archivo trae las
mismas filas y en el mismo orden que se ven en pantalla.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any, Callable, Optional, TypeVar, get_args

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.aptitud import services as aptitud_services
from src.checklist import services as checklist_services
from src.documentos import services as documentos_services
from src.documentos.constants import EstadoDocumentoFiltro, TipoDocumento
from src.elementoLimpieza import services as elementos_services
from src.Equipo import services as equipos_services
from src.incidente import services as incidentes_services
from src.incidente.constants import EstadoIncidente, OrigenIncidente
from src.ingredientes import services as ingredientes_services
from src.insumoQuimico import services as insumos_quimicos_services
from src.insumoQuimico.models import TipoQuimico
from src.personal import services as personal_services
from src.PlanCalibracionMantenimiento import services as planes_calibracion_services
from src.PlanLimpieza import services as planes_limpieza_services
from src.proveedores import services as proveedores_services
from src.sector import services as sectores_services
from src.unidadMedida import services as unidades_services

E = TypeVar("E", bound=Enum)


class FiltrosListado(BaseModel):
    """Filtros de los listados, con los nombres que usan sus endpoints."""

    # true: solo activos; false: solo dados de baja; sin valor: todos.
    activo: Optional[bool] = None
    buscar: Optional[str] = Field(None, max_length=100)
    orden: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    rol: Optional[str] = None
    es_aditivo: Optional[bool] = None
    unidad_medida_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    sector_id: Optional[int] = None
    equipo_id: Optional[int] = None
    reportado_por: Optional[int] = None
    origen: Optional[str] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None


Listado = Callable[[Session, FiltrosListado], list[Any]]

# Los servicios paginados son los que usa cada tabla: se pide una sola página
# con todas las filas.
_TODAS = {"page": 1, "page_size": 10**9}


def _bajas(f: FiltrosListado) -> dict[str, bool]:
    return {"incluir_inactivos": f.activo is None, "solo_inactivos": f.activo is False}


def _rechazar(valor: str) -> HTTPException:
    return HTTPException(status_code=422, detail=f"El filtro «{valor}» no es válido.")


def _opcion(opciones: type[E], valor: Optional[str]) -> Optional[E]:
    if valor is None:
        return None
    try:
        return opciones(valor)
    except ValueError as exc:
        raise _rechazar(valor) from exc


def _aptitudes(db: Session, f: FiltrosListado) -> list[Any]:
    return aptitud_services.listar_aptitudes_paginado(
        db, buscar=f.buscar, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _sectores(db: Session, f: FiltrosListado) -> list[Any]:
    return sectores_services.listar_sectores_paginado(
        db, buscar=f.buscar, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _unidades(db: Session, f: FiltrosListado) -> list[Any]:
    return unidades_services.listar_unidades_medida_paginado(
        db, buscar=f.buscar, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _elementos(db: Session, f: FiltrosListado) -> list[Any]:
    return elementos_services.listar_elementos_limpieza_paginado(
        db, buscar=f.buscar, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _equipos(db: Session, f: FiltrosListado) -> list[Any]:
    return equipos_services.listar_equipos_paginado(
        db,
        buscar=f.buscar,
        tipo=f.tipo,
        sector_id=f.sector_id,
        orden=f.orden,
        **_bajas(f),
        **_TODAS,
    )[0]


def _ingredientes(db: Session, f: FiltrosListado) -> list[Any]:
    return ingredientes_services.listar_ingredientes_paginado(
        db,
        buscar=f.buscar,
        unidad_medida_id=f.unidad_medida_id,
        es_aditivo=f.es_aditivo,
        proveedor_id=f.proveedor_id,
        orden=f.orden,
        **_bajas(f),
        **_TODAS,
    )[0]


def _insumos_quimicos(db: Session, f: FiltrosListado) -> list[Any]:
    return insumos_quimicos_services.listar_insumos_quimicos_paginado(
        db,
        buscar=f.buscar,
        tipo=_opcion(TipoQuimico, f.tipo),
        unidad_medida_id=f.unidad_medida_id,
        orden=f.orden,
        **_bajas(f),
        **_TODAS,
    )[0]


def _personal(db: Session, f: FiltrosListado) -> list[Any]:
    return personal_services.listar_personas_paginado(
        db, buscar=f.buscar, rol=f.rol, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _planes_calibracion(db: Session, f: FiltrosListado) -> list[Any]:
    return planes_calibracion_services.listar_planes_calibracion_mantenimiento_paginado(
        db,
        buscar=f.buscar,
        tipo=f.tipo,
        equipo_id=f.equipo_id,
        orden=f.orden,
        **_bajas(f),
        **_TODAS,
    )[0]


def _planes_limpieza(db: Session, f: FiltrosListado) -> list[Any]:
    return planes_limpieza_services.listar_planes_limpieza_paginado(
        db, buscar=f.buscar, equipo_id=f.equipo_id, orden=f.orden, **_bajas(f), **_TODAS
    )[0]


def _proveedores(db: Session, f: FiltrosListado) -> list[Any]:
    # El servicio no tiene "solo dados de baja": la pantalla los separa igual.
    proveedores = proveedores_services.listar_proveedores(
        db, incluir_inactivos=f.activo is not True, buscar=f.buscar
    )
    return [p for p in proveedores if f.activo is None or p.activo == f.activo]


def _documentos(db: Session, f: FiltrosListado) -> list[Any]:
    if f.estado is not None and f.estado not in get_args(EstadoDocumentoFiltro):
        raise _rechazar(f.estado)
    return documentos_services.listar_documentos(
        db,
        buscar=f.buscar,
        tipo=_opcion(TipoDocumento, f.tipo),
        orden=f.orden,
        estado=f.estado,
    )


def _incidentes(db: Session, f: FiltrosListado) -> list[Any]:
    return incidentes_services.listar_incidentes(
        db,
        estado=_opcion(EstadoIncidente, f.estado),
        tipo=f.tipo,
        equipo_id=f.equipo_id,
        orden=f.orden,
        buscar=f.buscar,
        fecha_desde=f.fecha_desde,
        fecha_hasta=f.fecha_hasta,
        reportado_por=f.reportado_por,
        origen=_opcion(OrigenIncidente, f.origen),
    )


def _checklists(db: Session, f: FiltrosListado) -> list[Any]:
    return checklist_services.listar_checklists_del_periodo(
        db,
        fecha_desde=f.fecha_desde or date.min,
        fecha_hasta=f.fecha_hasta or date.max,
        equipo_id=f.equipo_id,
        buscar=f.buscar,
        orden=f.orden,
    )


# nombre_tabla -> listado de su pantalla. Una tabla que no está acá se exporta
# tal cual, filtrando por igualdad de columnas (ver `motor.py`).
LISTADOS: dict[str, Listado] = {
    "aptituds": _aptitudes,
    "sectores": _sectores,
    "unidades_medida": _unidades,
    "elementos_limpieza": _elementos,
    "equipos": _equipos,
    "ingredientes": _ingredientes,
    "insumos_quimicos": _insumos_quimicos,
    "personal": _personal,
    "planes_calibracion_mantenimiento": _planes_calibracion,
    "planes_limpieza": _planes_limpieza,
    "proveedores": _proveedores,
    "documentos": _documentos,
    "incidentes": _incidentes,
    "checklists": _checklists,
}
