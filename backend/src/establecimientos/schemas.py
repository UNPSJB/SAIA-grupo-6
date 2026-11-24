from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _texto(v: Optional[str], obligatorio: bool) -> Optional[str]:
    if v is None:
        return None
    v = " ".join(v.split())
    if obligatorio and not v:
        raise ValueError("El nombre del establecimiento es obligatorio.")
    return v or None


class EstablecimientoCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    razon_social: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        return _texto(v, obligatorio=True)

    @field_validator("direccion", "razon_social")
    @classmethod
    def validar_direccion(cls, v: Optional[str]) -> Optional[str]:
        return _texto(v, obligatorio=False)


class EstablecimientoUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    razon_social: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return _texto(v, obligatorio=True)

    @field_validator("direccion", "razon_social")
    @classmethod
    def validar_direccion(cls, v: Optional[str]) -> Optional[str]:
        return _texto(v, obligatorio=False)


class Establecimiento(BaseModel):
    id: int
    nombre: str
    direccion: Optional[str] = None
    razon_social: Optional[str] = None
    activo: bool
    fecha_creacion: datetime
    # Personal activo de la sede (lo muestra la pantalla de establecimientos).
    personal_activo: int = 0

    model_config = ConfigDict(from_attributes=True)
