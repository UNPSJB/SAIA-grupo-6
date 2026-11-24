from src.exceptions import BadRequest, NotFound
from src.lotesInsumo.constants import ErrorCode


class LoteInsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.LOTE_NO_ENCONTRADO


class IngredienteNoEncontrado(BadRequest):
    DETAIL = ErrorCode.INGREDIENTE_NO_ENCONTRADO


class ProveedorNoEncontrado(BadRequest):
    DETAIL = ErrorCode.PROVEEDOR_NO_ENCONTRADO


class InsumoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO


class InsumoNoHomologado(BadRequest):
    DETAIL = ErrorCode.INSUMO_NO_HOMOLOGADO


class ProveedorNoVendeInsumo(BadRequest):
    DETAIL = ErrorCode.PROVEEDOR_NO_VENDE_INSUMO


class LoteInsumoYaExiste(BadRequest):
    DETAIL = ErrorCode.LOTE_YA_EXISTE


class NumeroVacio(BadRequest):
    DETAIL = ErrorCode.NUMERO_VACIO


class MotivoVacio(BadRequest):
    DETAIL = ErrorCode.MOTIVO_VACIO


class CantidadBajaInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_BAJA_INVALIDA


class CantidadSuperaSaldo(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_SUPERA_SALDO


class LoteYaDadoDeBaja(BadRequest):
    DETAIL = ErrorCode.LOTE_YA_DADO_DE_BAJA


class VencimientoAnterior(BadRequest):
    DETAIL = ErrorCode.VENCIMIENTO_ANTERIOR


class CertificacionProveedorNoVigente(BadRequest):
    DETAIL = ErrorCode.CERTIFICACION_NO_VIGENTE
    