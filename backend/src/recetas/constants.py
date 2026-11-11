CLASIFICACION_INGREDIENTE = "ingrediente"
CLASIFICACION_ADITIVO = "aditivo"
CLASIFICACIONES = (CLASIFICACION_INGREDIENTE, CLASIFICACION_ADITIVO)
MOTIVOFALTANTE = "MotivoFaltante"

TIPO_MASA = "masa"
TIPO_VOLUMEN = "volumen"
TIPO_UNIDAD = "unidad"
TIPOS = (TIPO_MASA, TIPO_VOLUMEN, TIPO_UNIDAD)



class ErrorCode:
    RECETA_NO_ENCONTRADA = "La receta no fue encontrada."
    VERSION_NO_ENCONTRADA = "La versión de receta no fue encontrada."
    PRODUCTO_NO_ENCONTRADO = "El producto no existe o fue dado de baja."
    RECETA_YA_EXISTE = (
        "El producto ya tiene una receta. Creá una versión nueva para modificarla."
    )
    SIN_TAREAS = "La receta necesita al menos una tarea."
    SIN_INSUMOS = "La receta necesita al menos un insumo."
    INSUMO_NO_ENCONTRADO = "El insumo no existe o está dado de baja."
    INSUMO_REPETIDO = "Un insumo no puede repetirse dentro de la misma receta."
    UNIDAD_NO_COINCIDE = (
        "La unidad indicada para el insumo debe ser la unidad de medida del insumo."
    )
    UNIDAD_NO_ENCONTRADA = "La unidad de medida no existe."
    TAREA_INSUMO_DESCONOCIDO = (
        "Una tarea usa un insumo que no está en la lista de insumos de la receta."
    )
    TAREA_INSUMO_REPETIDO = "Una tarea no puede repetir el mismo insumo."
    REPARTO_INCOMPLETO = (
        "La cantidad repartida entre las tareas debe sumar la cantidad total "
        "de cada insumo de la receta."
    )
    DESCRIPCION_VACIA = "La descripción de la tarea no puede estar vacía."
    VERSION_INMUTABLE = "Las versiones de receta son de solo lectura."
    SIN_INGREDIENTES = (
        "La receta necesita al menos un ingrediente: no puede tener solo aditivos."
    )
    ADITIVO_SIN_CLASE = (
        "Un aditivo de la receta no tiene clase funcional en el maestro de insumos. "
        "Completalo antes de guardar la receta."
    )
    PORCION_SIN_UNIDAD = "Indicá la unidad de medida de la porción."
    PORCION_UNIDAD_SIN_CANTIDAD = "Indicá la cantidad de la porción."
    ESCALADO_PARAMETRO = (
        "Indicá la cantidad objetivo o el factor multiplicador (uno de los dos)."
    )
    SIN_VERSION = "La receta todavía no tiene versiones."


class MotivoFaltante:
    """Por qué un insumo no se pudo convertir a gramos en la composición (E10)."""

    UNIDAD_SIN_EQUIVALENCIA = "La unidad de medida no tiene tipo o factor de conversión."
    SIN_DENSIDAD = "Falta la densidad del insumo (g/ml)."
    SIN_PESO_UNITARIO = "Falta el peso por unidad del insumo (g)."