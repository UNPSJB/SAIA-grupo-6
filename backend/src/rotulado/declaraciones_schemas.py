"""Contratos de evaluación de alérgenos y conservación (HU106).

La ausencia declarada de gluten es un dato del insumo, no una autorización
para rotular el producto como libre de gluten.
"""

from decimal import Decimal
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContratoDeclaracion(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CondicionConservacion(ContratoDeclaracion):
    temperatura_aplicable: bool = False
    temperatura_minima: Decimal | None = Field(default=None, allow_inf_nan=False)
    temperatura_maxima: Decimal | None = Field(default=None, allow_inf_nan=False)
    duracion_aplicable: bool = False
    duracion: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    unidad_duracion: Literal["horas", "dias", "meses"] | None = None
    instrucciones: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validar_condiciones(self):
        if not self.temperatura_aplicable and (
            self.temperatura_minima is not None or self.temperatura_maxima is not None
        ):
            raise ValueError("La temperatura no aplicable no admite valores.")
        if (self.temperatura_minima is not None
                and self.temperatura_maxima is not None
                and self.temperatura_minima > self.temperatura_maxima):
            raise ValueError("La temperatura mínima supera la máxima.")
        if (self.duracion is None) != (self.unidad_duracion is None):
            raise ValueError("La duración y su unidad deben indicarse juntas.")
        if not self.duracion_aplicable and self.duracion is not None:
            raise ValueError("La duración no aplicable no admite valores.")
        if self.instrucciones is not None:
            self.instrucciones = self.instrucciones.strip() or None
        return self

    def pendientes(self) -> list[str]:
        resultado = []
        if self.temperatura_aplicable and (
            self.temperatura_minima is None and self.temperatura_maxima is None
        ):
            resultado.append("temperatura")
        if self.duracion_aplicable and self.duracion is None:
            resultado.append("duracion")
        if not self.instrucciones:
            resultado.append("instrucciones")
        return resultado


class ConservacionProducto(CondicionConservacion):
    despues_abrir_aplicable: bool = False
    despues_abrir: CondicionConservacion | None = None

    @model_validator(mode="after")
    def validar_apertura(self):
        if not self.despues_abrir_aplicable and self.despues_abrir is not None:
            raise ValueError("Las condiciones después de abrir no son aplicables.")
        return self

    def pendientes(self) -> list[str]:
        resultado = super().pendientes()
        if self.despues_abrir_aplicable:
            if self.despues_abrir is None:
                resultado.append("despues_abrir")
            else:
                resultado.extend(f"despues_abrir.{p}" for p in self.despues_abrir.pendientes())
        return resultado


class MarcaAlergeno(ContratoDeclaracion):
    codigo: str = Field(min_length=1, max_length=80)
    forma: Literal["directa", "derivado"]


class PerfilInsumoDeclaracion(ContratoDeclaracion):
    evaluacion: Literal["sin_evaluar", "incompleta", "evaluada"] = "sin_evaluar"
    marcas: list[MarcaAlergeno] = Field(default_factory=list)
    gluten: Literal["desconocido", "presente", "ausencia_declarada"] = "desconocido"
    respaldo: str | None = Field(default=None, max_length=2000)
    observaciones: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validar_marcas(self):
        from src.rotulado.alergenos import NOMBRES
        if any(marca.codigo not in NOMBRES for marca in self.marcas):
            raise ValueError("Sustancia no registrada en el catálogo de alérgenos.")
        claves = [(marca.codigo, marca.forma) for marca in self.marcas]
        if len(claves) != len(set(claves)):
            raise ValueError("Hay marcas duplicadas.")
        return self


class ContaminacionCruzada(ContratoDeclaracion):
    codigo: str
    fundamento: str = Field(min_length=1, max_length=2000)
    respaldo: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validar(self):
        from src.rotulado.alergenos import NOMBRES
        if self.codigo not in NOMBRES:
            raise ValueError("Sustancia desconocida.")
        self.fundamento = self.fundamento.strip()
        self.respaldo = (self.respaldo or "").strip() or None
        if not self.fundamento:
            raise ValueError("Indicá el fundamento de la contaminación cruzada.")
        return self


class EvaluacionCondicionada(ContratoDeclaracion):
    codigo: str
    declarar: bool
    fundamento: str = Field(min_length=1, max_length=2000)
    respaldo: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validar(self):
        if not self.fundamento.strip() or not self.respaldo.strip():
            raise ValueError("La evaluación requiere fundamento y respaldo.")
        return self


class RevisionEsperada(ContratoDeclaracion):
    revision: int = Field(ge=0)


class EditarDeclaraciones(RevisionEsperada):
    contaminacion_cruzada: list[ContaminacionCruzada] | None = None
    conservacion: ConservacionProducto | None = None
    evaluaciones: list[EvaluacionCondicionada] | None = None


class RegenerarDeclaraciones(RevisionEsperada):
    version_id: int | None = Field(default=None, gt=0)
    usar_conservacion_producto: bool = False


class DeclaracionesOut(ContratoDeclaracion):
    revision: int
    estado: Literal["sugerida", "confirmada"]
    vigencia: Literal["vigente", "desactualizada"]
    contenido: dict | None
    pendientes: list[str]
    confirmado_por_id: int | None
    confirmado_por_nombre: str | None
    confirmado_en: datetime | None
    declaracion: str
    declaracion_cruzada: str
