from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.alergenos import exceptions
from src.common.validators import texto_no_vacio

Nivel = Literal["contiene", "puede_contener"]


class AlergenoCreate(BaseModel):
    nombre: str = Field(max_length=80)

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class AlergenoUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class AlergenoResponse(BaseModel):
    id: int
    nombre: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class AlergenoDeIngredienteIn(BaseModel):
    alergeno_id: int = Field(gt=0)
    nivel: Nivel


class AlergenosDeIngredienteIn(BaseModel):
    """La lista completa: los alérgenos que no vienen se quitan."""

    alergenos: list[AlergenoDeIngredienteIn] = Field(default_factory=list)


class AlergenoDeIngrediente(BaseModel):
    alergeno_id: int
    nombre: str
    nivel: Nivel


class AlergenosDeIngrediente(BaseModel):
    ingrediente_id: int
    alergenos: list[AlergenoDeIngrediente]


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
