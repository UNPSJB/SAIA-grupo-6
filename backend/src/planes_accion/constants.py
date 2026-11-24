"""Constantes del módulo de planes de acción."""

from enum import Enum


class EstadoPlan(str, Enum):
    """Ciclo de vida del plan (sección 5 del documento funcional).

    El vencimiento NO es un estado: es una marca aparte (ver `reglas.plan_vencido`).
    """

    BORRADOR = "borrador"
    EN_EJECUCION = "en_ejecucion"
    IMPLEMENTADO = "implementado"
    EN_VERIFICACION = "en_verificacion"
    CERRADO_EFICAZ = "cerrado_eficaz"
    CERRADO_PARCIAL = "cerrado_parcial"
    CERRADO_NO_EFICAZ = "cerrado_no_eficaz"
    CANCELADO = "cancelado"


class EstadoSituacionPlan(str, Enum):
    """Estado de cada situación del alcance (sección 6)."""

    PENDIENTE = "pendiente"
    ACCION_IMPLEMENTADA = "accion_implementada"
    CORREGIDA = "corregida"
    EFICAZ = "eficaz"
    NO_EFICAZ = "no_eficaz"


class TipoEvidencia(str, Enum):
    #: Demuestra que una acción se ejecutó. Se carga por acción.
    IMPLEMENTACION = "implementacion"
    #: Demuestra que la condición dejó de estar presente. Se carga por situación.
    VERIFICACION = "verificacion"


class MomentoRiesgo(str, Enum):
    """Cuándo se tomó la foto del riesgo de un elemento del alcance."""

    ANTES = "antes"
    IMPLEMENTADO = "implementado"
    CIERRE = "cierre"


class EventoHistorial(str, Enum):
    CREACION = "creacion"
    ESTADO = "estado"
    EDICION = "edicion"
    ACCION = "accion"
    ALCANCE = "alcance"
    EVIDENCIA = "evidencia"
    VERIFICACION = "verificacion"
    OBSERVACION = "observacion"


# Evidencias: formatos y tamaño máximo (mismo criterio que el resto de las
# evidencias del sistema: se valida el archivo, no el MIME del navegador).
EXTENSIONES_EVIDENCIA = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx"}
TAMANO_MAX_EVIDENCIA = 10 * 1024 * 1024
SUBCARPETA_EVIDENCIAS = "planes_accion"

# Período de observación configurable por tipo de situación (días).
DIAS_OBSERVACION_MAXIMO = 365


class ErrorCode:
    PLAN_NO_ENCONTRADO = "El plan de acción no fue encontrado."
    SITUACION_NO_ENCONTRADA = "La situación no fue encontrada."
    SITUACION_RESUELTA = "La situación ya no está presente: no se puede tratar con un plan."
    SITUACION_EN_OTRO_PLAN = "La situación ya pertenece a otro plan de acción activo."
    SITUACION_OTRO_TIPO = (
        "Una situación de otro tipo solo se puede sumar si es del mismo elemento que "
        "otra del alcance del plan."
    )
    CAUSA_NO_CONFIRMADA = (
        "Para sumar situaciones hay que confirmar que comparten una causa compatible "
        "con la del plan."
    )
    ESTADO_NO_PERMITE = "El plan está en un estado que no permite esta operación."
    PLAN_SIN_ACCIONES = "El plan necesita al menos una acción para pasar a ejecución."
    RESPONSABLE_INVALIDO = "El responsable indicado no existe o está dado de baja."
    PLAZO_PASADO = "El plazo no puede ser anterior a hoy."
    ACCION_NO_ENCONTRADA = "La acción no fue encontrada en este plan."
    ACCION_COMPLETADA = "La acción ya está completada: no se puede modificar ni borrar."
    EVIDENCIA_REQUERIDA = "Hay que describir la evidencia."
    MOTIVO_REQUERIDO = "Hay que indicar el motivo de la cancelación."
    PLAN_ANTERIOR_INVALIDO = (
        "Solo se puede vincular un plan cerrado: el anterior tiene que haber terminado."
    )
    PLAN_ANTERIOR_OTRO_TIPO = "El plan vinculado trató otro tipo de situación."
    NO_ES_ORIGEN = "La situación de origen no se puede quitar del alcance."
    OBSERVACION_FUERA_DE_RANGO = "El período de observación está fuera del rango permitido."
    VERIFICACION_MANUAL = (
        "Este tipo de situación no lo detecta el motor: la verificación necesita el "
        "resultado y su evidencia."
    )
    VERIFICADOR_NO_INDEPENDIENTE = (
        "Quien verifica no puede ser el responsable del plan ni de sus acciones: "
        "la verificación la tiene que hacer otra persona."
    )
    EVIDENCIA_VERIFICACION_CORTA = (
        "Para verificar a mano hay que describir la evidencia (al menos 10 caracteres)."
    )
    SITUACION_NO_VERIFICABLE = "La situación no está pendiente de verificación."
