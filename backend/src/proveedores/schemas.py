from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

class ProveedorBase(BaseModel):
    nombre: str
    cuit: str | None = None
    matricula: str | None = None
    contacto: str | None = None
    domicilio: str | None = None
    rubro: str | None = None
    es_certificado: bool = False

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v or not v.strip():
            raise ValueError("El nombre del proveedor no puede estar vacío.")
        return v.strip()

    @field_validator("cuit", "matricula", "contacto", "domicilio", "rubro")
    @classmethod
    def limpiar_opcionales(cls, v):
        return v.strip() if isinstance(v, str) and v.strip() else None

    @model_validator(mode="after")
    def validar_identificacion(self):
        if not self.cuit and not self.matricula:
            raise ValueError("Ingresá el CUIT del proveedor.")
        return self

class ProveedorCreate(ProveedorBase):
    pass

class ProveedorUpdate(BaseModel):
    nombre: str | None = None
    cuit: str | None = None
    matricula: str | None = None
    contacto: str | None = None
    domicilio: str | None = None
    rubro: str | None = None
    es_certificado: bool | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre_update(cls, v):
        if v is not None and not v.strip():
            raise ValueError("El nombre del proveedor no puede estar vacío.")
        return v.strip() if v is not None else None

    @field_validator("cuit", "matricula", "contacto", "domicilio", "rubro")
    @classmethod
    def limpiar_update(cls, v):
        return v.strip() if isinstance(v, str) and v.strip() else None

class InsumoResumen(BaseModel):
    """Insumo (marca) que vende el proveedor, con su ingrediente."""
    id: int
    nombre: str
    ingrediente_id: int
    ingrediente_nombre: str

class CertificacionCreate(BaseModel):
    tipo: str = Field(min_length=1, max_length=120)
    numero: str = Field(min_length=1, max_length=100)
    fecha_emision: date | None = None
    fecha_vencimiento: date
    @field_validator("tipo", "numero")
    @classmethod
    def validar_texto(cls, v):
        if not v.strip():
            raise ValueError("El campo no puede estar vacío.")
        return v.strip()

    @model_validator(mode="after")
    def validar_fechas(self):
        if self.fecha_emision and self.fecha_emision > self.fecha_vencimiento:
            raise ValueError("La fecha de emisión no puede ser posterior al vencimiento.")
        return self

class CertificacionResponse(BaseModel):
    id: int
    proveedor_id: int
    tipo: str
    numero: str
    fecha_emision: date | None
    fecha_vencimiento: date
    archivo_url: str
    fecha_carga: datetime
    model_config = ConfigDict(from_attributes=True)
    @computed_field
    @property
    def estado(self) -> str:
        return "vigente" if self.fecha_vencimiento >= date.today() else "vencida"

class ProveedorResponse(ProveedorBase):
    id: int
    activo: bool
    certificaciones: list[CertificacionResponse] = []
    insumos: list[InsumoResumen] = []
    model_config = ConfigDict(from_attributes=True)
    @computed_field
    @property
    def estado_certificacion(self) -> str | None:
        if not self.es_certificado:
            return None
        return "vigente" if any(c.fecha_vencimiento >= date.today() for c in self.certificaciones) else "vencida"

class AsociarInsumos(BaseModel):
    insumo_ids: list[int] = Field(default_factory=list)
