from pydantic import BaseModel, ConfigDict, field_validator
from src.common.paginacion import Pagina
from src.common.validators import texto_obligatorio
from src.sector import exceptions


class SectorBase(BaseModel):
    nombre: str
    descripcion: str | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return texto_obligatorio(
            v, vacio=exceptions.NombreVacio, invalido=exceptions.NombreInvalido
        )


class SectorCreate(SectorBase):
    pass


class SectorUpdate(SectorBase):
    """Ensancha la base para heredar sus validadores (que toleran `None`)."""

    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None


class SectorResponse(SectorBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class SectorResumen(BaseModel):
    """Versión mínima del sector, para incrustar en la respuesta de Equipo."""

    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class SectorPagina(Pagina[SectorResponse]):
    """Página de sectores: la respuesta del listado paginado en el servidor."""

    pass