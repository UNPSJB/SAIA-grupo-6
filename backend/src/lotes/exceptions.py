from src.exceptions import BadRequest, NotFound, PermissionDenied
from src.lotes.constants import ErrorCode


class TareaAsignadaAOtro(PermissionDenied):
    DETAIL = "Esta tarea está asignada a otra persona: solo ella (o quien administra) puede registrarla."


class AsignacionSoloAdministra(PermissionDenied):
    DETAIL = "Solo quien administra puede asignar las tareas de un lote."


class PersonaNoAsignable(BadRequest):
    DETAIL = "La persona elegida no existe, está dada de baja o no tiene permiso de operar."


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


class CantidadProducidaNoEntera(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_PRODUCIDA_NO_ENTERA


class VencimientoAnteriorAlCierre(BadRequest):
    DETAIL = ErrorCode.VENCIMIENTO_ANTERIOR_AL_CIERRE


class CantidadObjetivoNoEntera(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_OBJETIVO_NO_ENTERA


class MotivoVacio(BadRequest):
    DETAIL = ErrorCode.MOTIVO_VACIO


class LoteInsumoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.LOTE_INSUMO_NO_ENCONTRADO


class LoteInsumoDadoDeBaja(BadRequest):
    DETAIL = ErrorCode.LOTE_INSUMO_DADO_DE_BAJA


class InsumoNoHomologado(BadRequest):
    """La marca del lote no tiene la homologación aprobada y vigente."""

    DETAIL = "La marca de este lote no tiene la homologación aprobada y vigente."


class ConsumoNoEncontrado(NotFound):
    DETAIL = "El consumo no existe o no es de este lote."


class EtapaYaCompletada(BadRequest):
    """Una etapa hecha queda cerrada: no se le suman, corrigen ni borran consumos."""

    DETAIL = "La etapa ya está completada: sus consumos no se pueden modificar."


class LoteInsumoVencido(BadRequest):
    """Un lote de insumo vencido no entra a producción (queda para darlo de baja)."""

    DETAIL = "El lote de insumo está vencido: no se puede usar en producción."


class StockInsuficiente(BadRequest):
    """Lo que se consume no puede superar el saldo del lote de insumo: lo que
    falte sale de otro lote (se registra un consumo por cada uno)."""

    DETAIL = "El lote de insumo no tiene saldo suficiente."


class EtapaAnteriorPendiente(BadRequest):
    """Las etapas del lote se hacen en orden: no se registra nada en una
    mientras la anterior no esté completada."""

    DETAIL = "Primero hay que completar la etapa anterior del lote."


class ConsumoIncompleto(BadRequest):
    """La tarea no usó todavía lo que pide la receta de cada ingrediente."""

    DETAIL = "Antes de completar la tarea hay que registrar el consumo de lo que pide la receta."


class IngredienteNoPrevisto(BadRequest):
    DETAIL = ErrorCode.INGREDIENTE_NO_PREVISTO


class NumeroLoteNoGenerado(BadRequest):
    DETAIL = ErrorCode.NUMERO_LOTE_NO_GENERADO


class RangoFechasInvalido(BadRequest):
    DETAIL = "La fecha desde no puede ser posterior a la fecha hasta."


class LoteCerradoError(RuntimeError):
    """Respaldo del ORM: un lote cerrado (o sus hijos) no se modifica."""

    def __init__(self) -> None:
        super().__init__(ErrorCode.LOTE_CERRADO)
