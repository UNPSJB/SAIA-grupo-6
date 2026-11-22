from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio, texto_opcional
from src.insumos import exceptions


class InsumoCreate(BaseModel):
    ingrediente_id: int = Field(gt=0)
    marca: str = Field(max_length=120)
    descripcion: str | None = Field(default=None, max_length=200)
    codigo_fabricante: str | None = Field(default=None, max_length=60)
    proveedor_ids: list[int] = Field(default_factory=list)

    @field_validator("marca")
    @classmethod
    def validar_marca(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.MarcaVacia)

    @field_validator("descripcion", "codigo_fabricante")
    @classmethod
    def limpiar_opcionales(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class InsumoUpdate(BaseModel):
    """El ingrediente no se cambia: los lotes ya recibidos quedarían incoherentes."""

    marca: str | None = Field(default=None, max_length=120)
    descripcion: str | None = Field(default=None, max_length=200)
    codigo_fabricante: str | None = Field(default=None, max_length=60)
    proveedor_ids: list[int] | None = None
    activo: bool | None = None

    @field_validator("marca")
    @classmethod
    def validar_marca(cls, valor: str | None) -> str | None:
        return None if valor is None else texto_no_vacio(valor, vacio=exceptions.MarcaVacia)

    @field_validator("descripcion", "codigo_fabricante")
    @classmethod
    def limpiar_opcionales(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class ProveedorResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResumen(BaseModel):
    """Lo que se muestra de un insumo dentro de un lote, un consumo o un proveedor."""

    id: int
    marca: str
    descripcion: str | None = None
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResponse(BaseModel):
    id: int
    ingrediente_id: int
    ingrediente_nombre: str
    unidad: str
    marca: str
    descripcion: str | None
    codigo_fabricante: str | None
    nombre: str
    activo: bool
    proveedores: list[ProveedorResumen] = []
    # pendiente / aprobada / rechazada / requiere_revision. Solo "aprobada" recibe lotes.
    estado_homologacion: str
    # Solo de una aprobada: hasta cuándo vale y si ya venció (vencida no se usa).
    homologacion_vigente_hasta: date | None = None
    homologacion_vencida: bool = False


# ── Homologación ───────────────────────────────────────────────────────────

Nivel = Literal["contiene", "puede_contener"]


class ValorRotuloIn(BaseModel):
    nutriente: str
    # Tal como figura en el rótulo: por la porción, o por 100 g/ml si no hay.
    valor: Decimal = Field(ge=0, max_digits=14, decimal_places=4)


class AlergenoRotuloIn(BaseModel):
    alergeno_id: int = Field(gt=0)
    nivel: Nivel


class RotuloInsumoIn(BaseModel):
    """Rótulo completo del fabricante: lo que no viene se borra."""

    referencia: str | None = Field(default=None, max_length=300)
    # Porción (g o ml) por la que declara el rótulo; sin porción, por 100.
    porcion: Decimal | None = Field(default=None, gt=0, le=10000, max_digits=10, decimal_places=2)
    valores: list[ValorRotuloIn] = Field(default_factory=list)
    alergenos: list[AlergenoRotuloIn] = Field(default_factory=list)

    @field_validator("referencia")
    @classmethod
    def limpiar_referencia(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class ValorRotulo(BaseModel):
    nutriente: str
    valor: Decimal
    valor_100: Decimal


class AlergenoRotulo(BaseModel):
    alergeno_id: int
    nombre: str
    nivel: Nivel


class RotuloInsumo(BaseModel):
    referencia: str | None
    porcion: Decimal | None
    valores: list[ValorRotulo]
    alergenos: list[AlergenoRotulo]


class FilaComparacion(BaseModel):
    nutriente: str
    nombre: str
    unidad: str
    referencia: Decimal | None
    rotulo: Decimal | None
    desvio_pct: Decimal | None
    # ok / fuera_de_tolerancia / sin_dato / sin_referencia / bajo_umbral
    estado: str


class FilaAlergeno(BaseModel):
    alergeno_id: int
    nombre: str
    nivel_ingrediente: Nivel | None
    nivel_insumo: Nivel | None
    cumple: bool


class ComparacionHomologacion(BaseModel):
    # apta / observada / rechazada
    resultado: str
    tolerancia_pct: Decimal
    nutrientes: list[FilaComparacion]
    alergenos: list[FilaAlergeno]
    problemas: list[str]


class HomologacionInsumo(BaseModel):
    insumo_id: int
    insumo_nombre: str
    ingrediente_id: int
    ingrediente_nombre: str
    es_aditivo: bool
    estado: str
    resultado_al_decidir: str | None
    justificacion: str | None
    homologado_por: str | None
    homologado_en: datetime | None
    # Hasta cuándo vale la aprobación (Parámetros nutricionales → vigencia).
    vigente_hasta: date | None = None
    vencida: bool = False
    # Tolerancia (%) con que se comparó al decidir (la actual puede ser otra).
    tolerancia_al_decidir: Decimal | None = None
    rotulo: RotuloInsumo
    comparacion: ComparacionHomologacion


class DecisionHomologacionIn(BaseModel):
    decision: Literal["aprobar", "rechazar"]
    # Obligatoria para aprobar una comparación observada.
    justificacion: str | None = Field(default=None, max_length=500)

    @field_validator("justificacion")
    @classmethod
    def limpiar_justificacion(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)
