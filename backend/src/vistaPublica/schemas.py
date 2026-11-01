from typing import Literal, Optional

from pydantic import BaseModel


class ConfiguracionVistaPublicaUpdate(BaseModel):
    habilitada: bool


class ConfiguracionVistaPublicaResponse(BaseModel):
    habilitada: bool
    url_publica: Optional[str] = None


class ValidacionVistaPublicaResponse(BaseModel):
    valida: Literal[True] = True


# ───────────────────────── Indicadores ─────────────────────────


class IndicadorConfiguracion(BaseModel):
    """Indicador tal como lo ve el administrador en el panel."""

    clave: str
    etiqueta: str
    descripcion: str
    formato: Literal["porcentaje"] = "porcentaje"
    disponible: bool
    habilitado: bool
    # `False` = el indicador está visible pero todavía no tiene universo que
    # medir (o no alcanza el mínimo para publicarse). El panel lo avisa: el
    # visitante no ve esa tarjeta aunque el switch esté encendido.
    con_datos: bool = False


class IndicadoresVistaPublicaResponse(BaseModel):
    indicadores: list[IndicadorConfiguracion]


class IndicadorVistaPublicaUpdate(BaseModel):
    clave: str
    habilitado: bool


class IndicadoresVistaPublicaUpdate(BaseModel):
    indicadores: list[IndicadorVistaPublicaUpdate]


class IndicadorPublico(BaseModel):
    """Indicador ya calculado para la vista anónima."""

    clave: str
    etiqueta: str
    descripcion: str
    formato: Literal["porcentaje"] = "porcentaje"
    # `None` = todavía no hay datos suficientes. No se publica un 0 % falso.
    valor: Optional[float] = None
    # Mejora en puntos porcentuales respecto del período anterior. Solo se
    # informa cuando es positiva: la vista pública nunca publica una baja.
    tendencia: Optional[float] = None


class IndicadoresPublicosResponse(BaseModel):
    indicadores: list[IndicadorPublico]