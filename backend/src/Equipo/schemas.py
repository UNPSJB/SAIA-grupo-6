from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator
from src.common.validators import texto_no_vacio, id_positivo
from src.common.paginacion import Pagina
from src.Equipo import exceptions
from src.sector.schemas import SectorResumen


class EquipoBase(BaseModel):
    nombre: str
    sector_id: int
    tipo: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        # Corre también en EquipoUpdate, donde los campos son opcionales.
        if v is None:
            return v
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

    @field_validator("tipo")
    @classmethod
    def validar_tipo_no_vacia(cls, v: str | None) -> str | None:
        return texto_no_vacio(v, vacio=exceptions.TipoVacio)

    @field_validator("sector_id")
    @classmethod
    def validar_sector_id(cls, v: int | None) -> int | None:
        return id_positivo(v, invalido=exceptions.SectorInvalido)


class EquipoCreate(EquipoBase):
    pass


class EquipoUpdate(EquipoBase):
    nombre: str | None = None
    sector_id: int | None = None
    tipo: str | None = None
    activo: bool | None = None    


class EquipoResponse(EquipoBase):
    id: int
    activo: bool
    sector: SectorResumen

    model_config = ConfigDict(from_attributes=True)


class EquipoPagina(Pagina[EquipoResponse]):
    """Página de equipos: la respuesta del listado paginado en el servidor."""

    pass


class EquipoOpcionesResponse(BaseModel):
    """Valores distintos de los equipos activos, para los selects de filtro."""

    tipos: list[str]
    sectores: list[SectorResumen]


TipoIntervencion = Literal["calibracion", "mantenimiento"]


class CalibracionResponse(BaseModel):
    """Una intervención registrada, para el historial del equipo."""

    id: int
    fecha_realizacion: date
    proximo_vencimiento: date
    # Relativa a la carpeta de uploads: el frontend la pide por /uploads, que
    # exige sesión.
    certificado_url: str
    tipo: TipoIntervencion

    model_config = ConfigDict(from_attributes=True)
