from src.exceptions import BadRequest, NotFound
from src.lotesInsumo.constants import ErrorCode


class LoteInsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.LOTE_NO_ENCONTRADO


class InsumoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO


class ProveedorNoEncontrado(BadRequest):
    DETAIL = ErrorCode.PROVEEDOR_NO_ENCONTRADO


class LoteInsumoYaExiste(BadRequest):
    DETAIL = ErrorCode.LOTE_YA_EXISTE


class NumeroVacio(BadRequest):
    DETAIL = ErrorCode.NUMERO_VACIO


class MotivoVacio(BadRequest):
    DETAIL = ErrorCode.MOTIVO_VACIO


class LoteYaDadoDeBaja(BadRequest):
    DETAIL = ErrorCode.LOTE_YA_DADO_DE_BAJA


class VencimientoAnterior(BadRequest):
    DETAIL = ErrorCode.VENCIMIENTO_ANTERIOR
