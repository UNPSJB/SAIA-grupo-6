from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, field_validator
from src.vencimientoPersonal import exceptions


def _validar_no_vencida(v: date) -> date:
    if v < date.today():
        raise exceptions.FechaVencimientoPasada()
    return v


class VencimientoPersonalBase(BaseModel):
    aptitud_id: int
    fecha_vencimiento: date

    @field_validator("fecha_vencimiento")
    @classmethod
    def validar_fecha(cls, v: date) -> date:
        return _validar_no_vencida(v)


class VencimientoPersonalCreate(VencimientoPersonalBase):
    persona_id: int


class VencimientoPersonalUpdate(BaseModel):
    fecha_vencimiento: date | None = None

    @field_validator("fecha_vencimiento")
    @classmethod
    def validar_fecha(cls, v: date | None) -> date | None:
        if v is None:
            return v
        return _validar_no_vencida(v)


class VencimientoPersonalResponse(VencimientoPersonalBase):
    id: int
    persona_id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)