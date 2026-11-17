class ErrorCode:
    BORRADOR_NO_ENCONTRADO = "El borrador de rotulado no fue encontrado."
    PRODUCTO_NO_ENCONTRADO = "El producto no fue encontrado o no está activo."
    VERSION_NO_ENCONTRADA = "La versión de receta no fue encontrada."
    VERSION_NO_PERTENECE_AL_PRODUCTO = (
        "La versión de receta no pertenece al producto indicado."
    )
    LOTE_NO_ENCONTRADO = "El lote de producto no fue encontrado."
    LOTE_NO_PERTENECE_AL_PRODUCTO = "El lote no pertenece al producto indicado."
    LOTE_VERSION_INCOMPATIBLE = (
        "El lote no fue producido con la versión de receta indicada para el borrador."
    )


ESTADO_BORRADOR = "borrador"
ESTADO_COMPLETADO = "completado"

ESTADOS_BORRADOR = (ESTADO_BORRADOR, ESTADO_COMPLETADO)

CAMPO_COMPLETO = "completo"
CAMPO_PENDIENTE = "pendiente"
CAMPO_NO_APLICABLE = "no_aplicable"
CAMPO_SIN_DATOS_ORIGEN = "sin_datos_origen"

ESTADOS_CAMPO = (
    CAMPO_COMPLETO,
    CAMPO_PENDIENTE,
    CAMPO_NO_APLICABLE,
    CAMPO_SIN_DATOS_ORIGEN,
)

ORIGEN_PRODUCTO = "producto"
ORIGEN_RECETA = "receta"
ORIGEN_NUTRICION = "nutricion"
ORIGEN_LOTE = "lote"
ORIGEN_MANUAL = "manual"

ORIGINES = (
    ORIGEN_PRODUCTO,
    ORIGEN_RECETA,
    ORIGEN_NUTRICION,
    ORIGEN_LOTE,
    ORIGEN_MANUAL,
)

TIPO_AUTOCOMPLETADO = "autocompletado"
TIPO_EDICION_MANUAL = "edicion_manual"

TIPOS_OPERACION = (TIPO_AUTOCOMPLETADO, TIPO_EDICION_MANUAL)

CAMPOS_OBLIGATORIOS_BASE = (
    "denominacion_venta",
    "lista_ingredientes",
    "contenido_neto",
    "rnpa_rppa",
    "razon_social",
    "domicilio",
    "fecha_duracion",
)

CAMPOS_IMPORTADOR = (
    "importador_razon_social",
    "importador_domicilio",
)

CAMPOS_LOTE = ("identificacion_lote",)

CAMPOS_NUTRICION = ("datos_nutricionales_json",)
