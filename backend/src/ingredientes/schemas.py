from pydantic import BaseModel, ConfigDict, Field, field_validator
from src.aditivos.schemas import AditivoResumen, normalizar_ins
from src.common.paginacion import Pagina
from src.ingredientes import exceptions

class IngredienteBase(BaseModel):
    nombre: str
    unidad_medida_id: int
    densidad_g_ml: float | None = None
    peso_unitario_g: float | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()


class IngredienteCreate(IngredienteBase):
    es_aditivo: bool = False
    # Solo para aditivos.
    clase_funcional_id: int | None = Field(default=None, gt=0)
    numero_ins: str | None = Field(default=None, max_length=20)

    @field_validator("numero_ins")
    @classmethod
    def validar_ins(cls, v):
        return normalizar_ins(v)


class IngredienteUpdate(BaseModel):
    nombre: str | None = None
    unidad_medida_id: int | None = None
    activo: bool | None = None
    es_aditivo: bool | None = None
    clase_funcional_id: int | None = Field(default=None, gt=0)
    # Mandar null borra el INS (en las clases donde es opcional).
    numero_ins: str | None = Field(default=None, max_length=20)
    densidad_g_ml: float | None = None
    peso_unitario_g: float | None = None

    # Igual que el alta: sin esto se podían guardar nombres vacíos al editar.
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if v is None:
            return None
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

    @field_validator("numero_ins")
    @classmethod
    def validar_ins(cls, v):
        return normalizar_ins(v)

class ProveedorResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)
    
class Ingrediente(IngredienteBase):
    id: int
    activo: bool
    es_aditivo: bool
    clase_funcional_id: int | None = None
    numero_ins: str | None = None
    # Resumen para mostrar (clase funcional, nombre e INS); None si no es aditivo.
    aditivo: AditivoResumen | None = None
    proveedores: list[ProveedorResumen] = []
    unidad_medida: "UnidadMedidaResponse"

    model_config = ConfigDict(from_attributes=True)



class UnidadMedidaResponse(BaseModel):
    id: int
    nombre: str
    simbolo: str
    tipo: str | None = None

    model_config = ConfigDict(from_attributes=True)


class IngredientePagina(Pagina[Ingrediente]):
    """Página de ingredientes: la respuesta del listado paginado en el servidor."""

    pass

ProveedorResumen.model_rebuild()
Ingrediente.model_rebuild()
IngredientePagina.model_rebuild()