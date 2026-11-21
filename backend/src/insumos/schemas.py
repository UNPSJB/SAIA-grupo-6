from typing import Literal
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from src.aditivos.schemas import AditivoResumen
from src.common.paginacion import Pagina
from src.insumos import exceptions

from src.rotulado.declaraciones_schemas import PerfilInsumoDeclaracion

TipoInsumo = Literal["ingrediente", "aditivo"]


class InsumoBase(BaseModel):
    perfil_declaracion: PerfilInsumoDeclaracion | None = None
    nombre: str
    unidad_medida_id: int
    densidad_g_ml: float | None = None
    peso_unitario_g: float | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()


class InsumoCreate(InsumoBase):
    tipo: TipoInsumo = "ingrediente"
    aditivo_id: int | None = Field(default=None, gt=0)


class InsumoUpdate(BaseModel):
    perfil_declaracion: PerfilInsumoDeclaracion | None = None
    nombre: str | None = None
    unidad_medida_id: int | None = None
    activo: bool | None = None
    tipo: TipoInsumo | None = None
    aditivo_id: int | None = Field(default=None, gt=0)
    densidad_g_ml: float | None = None
    peso_unitario_g: float | None = None

    # Igual que el alta: sin esto se podían guardar nombres vacíos al editar.
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if v is None:
            return None
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

class ProveedorResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)
    
class Insumo(InsumoBase):
    perfil_actualizado_en: datetime | None = None
    perfil_actualizado_por_id: int | None = None
    id: int
    activo: bool
    tipo: str
    aditivo_id: int | None = None
    aditivo: AditivoResumen | None = None
    proveedores: list[ProveedorResumen] = []
    unidad_medida: "UnidadMedidaResponse"

    model_config = ConfigDict(from_attributes=True)

    @field_validator("aditivo", mode="before")
    @classmethod
    def resumir_aditivo(cls, valor):
        """El modelo trae el `Aditivo` del ORM; la respuesta, su resumen plano."""
        if valor is None or isinstance(valor, (dict, AditivoResumen)):
            return valor
        return AditivoResumen(
            id=valor.id,
            nombre=valor.nombre,
            numero_ins=valor.numero_ins,
            clase_funcional=valor.clase_funcional.nombre,
            ins_opcional=valor.clase_funcional.ins_opcional,
        )


class UnidadMedidaResponse(BaseModel):
    id: int
    nombre: str
    simbolo: str
    tipo: str | None = None

    model_config = ConfigDict(from_attributes=True)


class InsumoPagina(Pagina[Insumo]):
    """Página de insumos: la respuesta del listado paginado en el servidor."""

    pass

ProveedorResumen.model_rebuild()
Insumo.model_rebuild()
InsumoPagina.model_rebuild()
