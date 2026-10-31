from datetime import date
from typing import List
from pydantic import BaseModel

from src.common.paginacion import Pagina


class VencimientoConsolidadoResponse(BaseModel):
    id_vencimiento: str
    tipo: str  # PERSONAL | CALIBRACION | MANTENIMIENTO
    entidad_id: int
    sujeto_id: int
    detalle: str  # qué vence: la aptitud, o "Calibración" / "Mantenimiento"
    sujeto: str  # de quién o de qué: la persona o el equipo
    fecha_vencimiento: date
    dias_restantes: int  # negativo = ya venció
    estado: str  # VENCIDO | PROXIMO | VIGENTE
    link_destino: str


class VencimientoPagina(Pagina[VencimientoConsolidadoResponse]):
    """Página de vencimientos consolidados: la respuesta del listado paginado."""

    pass


class OpcionPersona(BaseModel):
    """Para el selector de personas del filtro de vencimientos."""

    id: int
    nombre: str


class VencimientosOpcionesResponse(BaseModel):
    """Valores distintos que hay en los vencimientos, para llenar los dropdowns
    de filtros sin traer la tabla entera al navegador."""

    personas: List[OpcionPersona]
    aptitudes: List[str]