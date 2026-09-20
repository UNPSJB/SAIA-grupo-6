from src.exceptions import NotFound, BadRequest, PermissionDenied
from src.PlanLimpieza.constants import ErrorCode


class PlanLimpiezaNoEncontrado(NotFound):
    DETAIL = ErrorCode.PLAN_LIMPIEZA_NO_ENCONTRADO


class DatoDuplicado(BadRequest):
    DETAIL = ErrorCode.DATO_DUPLICADO


class AutorNoEncontrado(NotFound):
    DETAIL = ErrorCode.AUTOR_NO_ENCONTRADO


class AutorInactivo(BadRequest):
    DETAIL = ErrorCode.AUTOR_INACTIVO


class AutorSinPermisoDeAdministrar(PermissionDenied):
    DETAIL = ErrorCode.AUTOR_SIN_PERMISO_DE_ADMINISTRAR


class NombrePlanDuplicado(BadRequest):
    DETAIL = ErrorCode.NOMBRE_PLAN_DUPLICADO


class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO


class FrecuenciaInvalida(BadRequest):
    DETAIL = ErrorCode.FRECUENCIA_INVALIDA


class TareasVacias(BadRequest):
    DETAIL = ErrorCode.TAREAS_VACIAS


class EquipoIdInvalido(BadRequest):
    DETAIL = ErrorCode.EQUIPO_ID_INVALIDO


class AutorIdInvalido(BadRequest):
    DETAIL = ErrorCode.AUTOR_ID_INVALIDO
