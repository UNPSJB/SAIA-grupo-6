from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field, field_validator, model_validator

from src.certificaciones_transportista import exceptions
from src.certificaciones_transportista.estado import estado_certificacion
from src.common.validators import texto_no_vacio, texto_opcional


class CertificacionTransportistaBase(BaseModel):
    tipo: str
    numero: str
    fecha_emision: date
    fecha_vencimiento: date
    observaciones: str | None = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.TipoVacio)

    @field_validator("numero")
    @classmethod
    def validar_numero(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.NumeroVacio)

    @field_validator("observaciones")
    @classmethod
    def validar_observaciones(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class CertificacionTransportistaCreate(CertificacionTransportistaBase):
    @model_validator(mode="after")
    def validar_fechas(self):
        # Se permite cargar una certificación ya vencida; lo único inválido
        # es que el vencimiento sea anterior a la emisión.
        if self.fecha_vencimiento < self.fecha_emision:
            raise exceptions.FechaVencimientoInvalida()
        return self


class CertificacionTransportistaUpdate(BaseModel):
    """Solo se pueden editar las observaciones.

    `extra="forbid"` hace que un intento de mandar `tipo`, `fecha_emision`,
    `fecha_vencimiento`, `numero` o `activa` se rechace con 422 en vez de
    ignorarse silenciosamente. Para corregir esos datos se anula y se carga
    una certificación nueva.
    """

    observaciones: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("observaciones")
    @classmethod
    def validar_observaciones(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class CertificacionTransportistaAnular(BaseModel):
    motivo: str

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.MotivoAnulacionRequerido)


class CertificacionTransportistaResponse(CertificacionTransportistaBase):
    id: int
    transportista_id: int
    archivo_url: str | None = None
    activa: bool
    anulada: bool
    motivo_anulacion: str | None = None
    anulada_por: int | None = None
    fecha_anulacion: datetime | None = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estado(self) -> str:
        return estado_certificacion(self)
