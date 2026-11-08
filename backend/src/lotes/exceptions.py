from src.exceptions import BadRequest, NotFound
from src.lotes.constants import ErrorCode


class LoteNoEncontrado(NotFound):
    DETAIL = ErrorCode.LOTE_NO_ENCONTRADO


class ItemNoEncontrado(NotFound):
    DETAIL = ErrorCode.ITEM_NO_ENCONTRADO


class ProductoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class ProductoSinReceta(BadRequest):
    DETAIL = ErrorCode.PRODUCTO_SIN_RECETA


class LoteCerrado(BadRequest):
    DETAIL = ErrorCode.LOTE_CERRADO


class ItemYaCompletado(BadRequest):
    DETAIL = ErrorCode.ITEM_YA_COMPLETADO


class ChecklistIncompleto(BadRequest):
    DETAIL = ErrorCode.CHECKLIST_INCOMPLETO


class CantidadProducidaInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_PRODUCIDA_INVALIDA


class MotivoVacio(BadRequest):
    DETAIL = ErrorCode.MOTIVO_VACIO


class LoteInsumoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.LOTE_INSUMO_NO_ENCONTRADO


class LoteInsumoDadoDeBaja(BadRequest):
    DETAIL = ErrorCode.LOTE_INSUMO_DADO_DE_BAJA


class InsumoNoPrevisto(BadRequest):
    DETAIL = ErrorCode.INSUMO_NO_PREVISTO


class NumeroLoteNoGenerado(BadRequest):
    DETAIL = ErrorCode.NUMERO_LOTE_NO_GENERADO


class RangoFechasInvalido(BadRequest):
    DETAIL = "La fecha desde no puede ser posterior a la fecha hasta."


class LoteCerradoError(RuntimeError):
    """Respaldo del ORM: un lote cerrado (o sus hijos) no se modifica."""

    def __init__(self) -> None:
        super().__init__(ErrorCode.LOTE_CERRADO)
