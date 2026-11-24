from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _a_dict_resumen(valor: Any) -> Any:
    """Convierte una entidad ORM (Cliente) en `{"id", "nombre"}`."""
    if valor is None or isinstance(valor, dict):
        return valor
    return {"id": valor.id, "nombre": valor.nombre}


def _a_producto_resumen(valor: Any) -> Any:
    """Convierte un `Producto` ORM en `{"id", "nombre", "unidad_medida"}`."""
    if valor is None or isinstance(valor, dict):
        return valor
    um = getattr(valor, "unidad_medida", None)
    if isinstance(um, str):
        unidad_str: Optional[str] = um
    elif um is not None:
        unidad_str = getattr(um, "simbolo", None) or getattr(um, "nombre", None)
    else:
        unidad_str = None
    return {
        "id": valor.id,
        "nombre": valor.nombre,
        "unidad_medida": unidad_str,
    }


class ProductoResumenReposicion(BaseModel):
    id: int
    nombre: str
    unidad_medida: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


EntidadResumen = Annotated[dict[str, Any], BeforeValidator(_a_dict_resumen)]
ProductoResumen = Annotated[
    ProductoResumenReposicion, BeforeValidator(_a_producto_resumen)
]


class ReposicionBase(BaseModel):
    cliente_id: int
    producto_id: int
    cantidad_original: Decimal
    cantidad_pendiente: Decimal
    estado: str
    prioridad: str
    origen: str


class ReposicionCumplirRequest(BaseModel):
    """Cuerpo de `POST /reposiciones/{reposicion_id}/cumplir`."""

    lote_id: int = Field(..., ge=1)
    cantidad_a_reponer: Decimal = Field(..., gt=0)


class ReposicionResponse(ReposicionBase):
    id: int
    fecha_registro: datetime
    motivo_anulacion: Optional[str] = None
    retiro_origen_id: Optional[int] = None
    salida_origen_id: Optional[int] = None
    incidente_origen_id: Optional[int] = None
    cliente: EntidadResumen
    producto: ProductoResumen

    model_config = ConfigDict(from_attributes=True)
