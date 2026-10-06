from src.PlanCalibracionMantenimiento.constants import ErrorCode
from src.exceptions import BadRequest, NotFound, PermissionDenied


class PlanCalibracionMantenimientoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PLAN_CALIBRACION_MANTENIMIENTO_NO_ENCONTRADO


class EquipoNoEncontrado(NotFound):
    DETAIL = ErrorCode.EQUIPO_NO_ENCONTRADO


class EquipoInactivo(BadRequest):
    DETAIL = ErrorCode.EQUIPO_INACTIVO


class AutorNoEncontrado(NotFound):
    DETAIL = ErrorCode.AUTOR_NO_ENCONTRADO


class AutorInactivo(BadRequest):
    DETAIL = ErrorCode.AUTOR_INACTIVO


class AutorSinPermisoDeAdministrar(PermissionDenied):
    DETAIL = ErrorCode.AUTOR_SIN_PERMISO_DE_ADMINISTRAR


class PlanActivoDuplicado(BadRequest):
    DETAIL = ErrorCode.PLAN_ACTIVO_DUPLICADO


class EquipoIdInvalido(BadRequest):
    DETAIL = ErrorCode.EQUIPO_ID_INVALIDO

