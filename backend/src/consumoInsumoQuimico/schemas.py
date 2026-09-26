from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from src.consumoInsumoQuimico import exceptions


class ConsumoInsumoQuimicoCreate(BaseModel):
    insumo_quimico_id: int
    cantidad: float

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, value: float) -> float:
        if value <= 0:
            raise exceptions.CantidadInvalida()

        return value


class ConsumoInsumoQuimicoResponse(BaseModel):
    id: int
    registro_tarea_id: int
    insumo_quimico_id: int
    cantidad: float
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsumoInsumoQuimicoAcumuladoResponse(BaseModel):
    insumo_quimico_id: int
    nombre: str
    unidad_medida: str
    cantidad_total: float