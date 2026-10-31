from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoteBase(BaseModel):
    codigo_lote: str = Field(max_length=50)
    producto_nombre: str = Field(max_length=120)
    cantidad_planificada: int = Field(gt=0)

    @field_validator("codigo_lote")
    @classmethod
    def validar_codigo_lote(cls, valor: str) -> str:
        texto = valor.strip()
        if not texto:
            raise ValueError("El código de lote no puede estar vacío.")
        return texto

    @field_validator("producto_nombre")
    @classmethod
    def validar_producto_nombre(cls, valor: str) -> str:
        texto = valor.strip()
        if not texto:
            raise ValueError("El nombre del producto no puede estar vacío.")
        return texto


class LoteCreate(LoteBase):
    pass


class LoteResponse(LoteBase):
    id: int
    cantidad_producida: int
    estado: str
    fecha_inicio: datetime

    model_config = ConfigDict(from_attributes=True)


class LoteResumenEstado(BaseModel):
    estado: str
    cantidad: int


class DashboardLotesResponse(BaseModel):
    total_lotes: int
    total_cantidad_planificada: int
    total_cantidad_producida: int
    porcentaje_cumplimiento: float
    por_estado: list[LoteResumenEstado]
