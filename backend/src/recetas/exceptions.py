from src.exceptions import BadRequest, NotFound
from src.recetas.constants import ErrorCode


class RecetaNoEncontrada(NotFound):
    DETAIL = ErrorCode.RECETA_NO_ENCONTRADA


class VersionNoEncontrada(NotFound):
    DETAIL = ErrorCode.VERSION_NO_ENCONTRADA


class ProductoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class RecetaYaExiste(BadRequest):
    DETAIL = ErrorCode.RECETA_YA_EXISTE


class SinTareas(BadRequest):
    DETAIL = ErrorCode.SIN_TAREAS


class SinInsumos(BadRequest):
    DETAIL = ErrorCode.SIN_INSUMOS


class InsumoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO


class InsumoRepetido(BadRequest):
    DETAIL = ErrorCode.INSUMO_REPETIDO


class UnidadNoCoincide(BadRequest):
    DETAIL = ErrorCode.UNIDAD_NO_COINCIDE


class UnidadNoEncontrada(BadRequest):
    DETAIL = ErrorCode.UNIDAD_NO_ENCONTRADA


class TareaInsumoDesconocido(BadRequest):
    DETAIL = ErrorCode.TAREA_INSUMO_DESCONOCIDO


class TareaInsumoRepetido(BadRequest):
    DETAIL = ErrorCode.TAREA_INSUMO_REPETIDO


class RepartoIncompleto(BadRequest):
    DETAIL = ErrorCode.REPARTO_INCOMPLETO


class DescripcionVacia(BadRequest):
    DETAIL = ErrorCode.DESCRIPCION_VACIA


class VersionRecetaInmutableError(RuntimeError):
    """Se intentó modificar o borrar una versión de receta ya creada."""

    def __init__(self) -> None:
        super().__init__(ErrorCode.VERSION_INMUTABLE)


class SinIngredientes(BadRequest):
    DETAIL = ErrorCode.SIN_INGREDIENTES


class AditivoSinClase(BadRequest):
    DETAIL = ErrorCode.ADITIVO_SIN_CLASE


class PorcionSinUnidad(BadRequest):
    DETAIL = ErrorCode.PORCION_SIN_UNIDAD


class PorcionUnidadSinCantidad(BadRequest):
    DETAIL = ErrorCode.PORCION_UNIDAD_SIN_CANTIDAD


class EscaladoParametroInvalido(BadRequest):
    DETAIL = ErrorCode.ESCALADO_PARAMETRO


class RecetaSinVersion(BadRequest):
    DETAIL = ErrorCode.SIN_VERSION
