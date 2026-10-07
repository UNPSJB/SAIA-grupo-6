from enum import StrEnum


class ErrorCode:
    DOCUMENTO_NO_ENCONTRADO = "El documento no fue encontrado."
    DOCUMENTO_YA_EXISTE = "Ya existe un documento con ese nombre."
    NOMBRE_VACIO = "El nombre del documento no puede estar vacío."
    VERSION_CONCURRENTE = (
        "Otra persona subió una versión al mismo tiempo. Volvé a intentarlo."
    )
    ARCHIVO_EXTENSION_INVALIDA = ("Formato de archivo no permitido. Formatos válidos: "
    "pdf, doc, docx, xls, xlsx, png, jpg, jpeg."
    )
    ARCHIVO_VACIO = "El archivo está vacío."
    ARCHIVO_MUY_GRANDE = "El archivo supera el tamaño máximo permitido (10 MB)."
    USUARIO_NO_ENCONTRADO = "El usuario indicado no existe."
    USUARIO_INACTIVO = "El usuario indicado está dado de baja."
    USUARIO_SIN_PERMISO_DE_ADMINISTRAR = (
        "Solo una persona con permiso de administrar puede realizar esta acción."
    )


class TipoDocumento(StrEnum):
    MANUAL_BPM = "manual_bpm"
    FICHA_TECNICA = "ficha_tecnica"
    PROCEDIMIENTO = "procedimiento"
    RECETA = "receta"


class EstadoVersion(StrEnum):
    VIGENTE = "vigente"
    ARCHIVADA = "archivada"


EXTENSIONES_PERMITIDAS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"}
TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB
CARPETA_DOCUMENTOS = "uploads/documentos"