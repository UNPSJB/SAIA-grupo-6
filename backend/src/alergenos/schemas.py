from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.alergenos import exceptions
from src.common.validators import texto_no_vacio, texto_opcional

Nivel = Literal["contiene", "puede_contener"]
Forma = Literal["directa", "derivado"]
Evaluacion = Literal["sin_evaluar", "incompleta", "evaluada"]
Gluten = Literal["desconocido", "presente", "ausencia_declarada"]


class AlergenoCreate(BaseModel):
    nombre: str = Field(max_length=80)
    condicionada: bool = False

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class AlergenoUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    condicionada: bool | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class AlergenoResponse(BaseModel):
    id: int
    codigo: str
    nombre: str
    condicionada: bool
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class AlergenoDeIngredienteIn(BaseModel):
    alergeno_id: int = Field(gt=0)
    nivel: Nivel
    forma: Forma = "directa"

    @model_validator(mode="after")
    def derivado_solo_si_contiene(self):
        if self.forma == "derivado" and self.nivel != "contiene":
            raise exceptions.DerivadoSoloContiene()
        return self


class AlergenosDeIngredienteIn(BaseModel):
    """La lista completa: los alérgenos que no vienen se quitan.

    La evaluación, el gluten, el respaldo y las observaciones que no vienen
    (o vienen en null, salvo los textos) quedan como estaban.
    """

    alergenos: list[AlergenoDeIngredienteIn] = Field(default_factory=list)
    evaluacion: Evaluacion | None = None
    gluten: Gluten | None = None
    respaldo: str | None = Field(default=None, max_length=2000)
    observaciones: str | None = Field(default=None, max_length=2000)

    @field_validator("respaldo", "observaciones")
    @classmethod
    def limpiar_texto(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class AlergenoDeIngrediente(BaseModel):
    alergeno_id: int
    codigo: str
    nombre: str
    nivel: Nivel
    forma: Forma


class AlergenosDeIngrediente(BaseModel):
    ingrediente_id: int
    alergenos: list[AlergenoDeIngrediente]
    evaluacion: Evaluacion
    gluten: Gluten
    respaldo: str | None = None
    observaciones: str | None = None
    actualizado_en: datetime | None = None
    actualizado_por: str | None = None


class AlergenoDeProducto(BaseModel):
    alergeno_id: int
    nombre: str
    # Ingredientes de la receta que lo aportan en ese nivel.
    ingredientes: list[str]


class AlergenosDeProducto(BaseModel):
    """Alérgenos del producto según su receta.

    Si un ingrediente contiene un alérgeno, el producto lo contiene, aunque
    otro ingrediente diga que solo puede contenerlo.
    """

    producto_id: int
    version_id: int | None
    contiene: list[AlergenoDeProducto]
    puede_contener: list[AlergenoDeProducto]
    # Texto listo para el rótulo ("Contiene: ... Puede contener: ...").
    leyenda: str | None
