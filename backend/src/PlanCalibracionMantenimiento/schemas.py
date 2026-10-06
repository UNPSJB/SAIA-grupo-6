from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.PlanCalibracionMantenimiento import exceptions


TipoPlanCalibracionMantenimiento = Literal["calibracion", "mantenimiento"]


class PlanCalibracionMantenimientoBase(BaseModel):
    equipo_id: int
    tipo: TipoPlanCalibracionMantenimiento
    fecha_ultima_intervencion: date
    periodicidad_dias: int = Field(ge=1)

    @field_validator("equipo_id")
    @classmethod
    def validar_equipo_id(cls, value: int) -> int:
        if value <= 0:
            raise exceptions.EquipoIdInvalido()
        return value

class PlanCalibracionMantenimientoCreate(PlanCalibracionMantenimientoBase):
    pass


class PlanCalibracionMantenimientoUpdate(PlanCalibracionMantenimientoBase):
    """Ensancha la base para heredar sus validadores, y suma `activo` para que
    el plan se pueda dar de baja (antes `activo` era de solo lectura y ningun
    endpoint podia moverlo)."""

    equipo_id: Optional[int] = None
    tipo: Optional[TipoPlanCalibracionMantenimiento] = None
    fecha_ultima_intervencion: Optional[date] = None
    periodicidad_dias: Optional[int] = Field(default=None, ge=1)
    activo: Optional[bool] = None

    @field_validator("equipo_id")
    @classmethod
    def validar_equipo_id(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise exceptions.EquipoIdInvalido()
        return value

class PlanCalibracionMantenimiento(BaseModel):
    id: int
    equipo_id: int
    autor_id: int
    tipo: TipoPlanCalibracionMantenimiento
    fecha_ultima_intervencion: date
    periodicidad_dias: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None
    proxima_fecha_vencimiento: date
    dias_restantes: int

    model_config = ConfigDict(from_attributes=True)
