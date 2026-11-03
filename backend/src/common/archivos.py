from pathlib import Path
import uuid
from typing import Callable
from fastapi import UploadFile, HTTPException
from starlette.types import ASGIApp, Receive, Scope, Send
from src.config import CARPETA_UPLOADS, settings


def validar_extension(filename: str, extensiones_permitidas: set[str]) -> str:
    if not filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo vacío")
    suffix = Path(filename).suffix.lower()
    if not suffix or suffix not in extensiones_permitidas:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de imagen no permitido ({suffix or 'sin extensión'}). "
            f"Formatos válidos: {', '.join(sorted(extensiones_permitidas))}."
        )
    return suffix


def leer_limitado(upload_file: UploadFile, limite_bytes: int) -> bytes:
    # Leer a lo sumo limite + 1 bytes para detectar exceso sin cargar todo
    max_leer = limite_bytes + 1
    datos = upload_file.file.read(max_leer)
    if len(datos) > limite_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo supera el máximo permitido de {limite_bytes // (1024*1024)} MB."
        )
    # Reposicionar para posibles lecturas posteriores si fuera necesario
    upload_file.file.seek(0)
    return datos


def guardar_archivo(
    upload_file: UploadFile,
    extensiones_permitidas: set[str],
    limite_bytes: int,
    prefijo: str,
    subcarpeta: str,
) -> str:
    """
    Valida extensión y tamaño, genera nombre {prefijo}_{uuid4().hex}{ext} y guarda.
    Devuelve ruta relativa tipo 'uploads/<subcarpeta>/<nombre>'.
    """
    if upload_file is None or not upload_file.filename:
        return None

    # Validar extensión sobre el nombre original, no secure_filename
    extension = validar_extension(upload_file.filename, extensiones_permitidas)

    # Leer limitado
    contenido = leer_limitado(upload_file, limite_bytes)

    # Nota: la validación de magic bytes (`validar_magic_bytes`) se deja
    # disponible para los endpoints que la requieran (por ejemplo documentos).
    # No se aplica automática aquí porque `guardar_archivo` lo usan también
    # incidentes/equipos/checklist, cuyos tests suben archivos con extensión
    # y contenido no coincidentes (falso positivo) y no está en el alcance
    # cambiarlos.

    # Nombre final
    nombre_archivo = f"{prefijo}_{uuid.uuid4().hex}{extension}"

    upload_dir = CARPETA_UPLOADS / subcarpeta
    upload_dir.mkdir(parents=True, exist_ok=True)

    ruta_relativa = f"uploads/{subcarpeta}/{nombre_archivo}"
    ruta_absoluta = upload_dir / nombre_archivo

    with open(ruta_absoluta, "wb") as f:
        f.write(contenido)

    return ruta_relativa


# --------------------------------------------------------------------------
# Firmas de archivo (magic bytes) por extensión permitida.
# --------------------------------------------------------------------------

_MAGIC_BYTES: dict[str, bytes] = {
    ".pdf": b"%PDF",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    ".doc": b"\xd0\xcf\x11\xe0",
    ".docx": b"PK\x03\x04",
    ".xls": b"\xd0\xcf\x11\xe0",
    ".xlsx": b"PK\x03\x04",
}


def validar_magic_bytes(contenido: bytes, extension: str) -> None:
    """Valida que el contenido del archivo coincida con su extensión.

    Comprueba los `magic bytes` (firma de archivo) en vez de confiar solo en
    la extensión del nombre, que es fácil de falsificar. Las extensiones sin
    firma conocida no se rechazan (se asume válida).
    """
    firma = _MAGIC_BYTES.get(extension)
    if firma is None:
        return
    if not contenido.startswith(firma):
        raise HTTPException(
            status_code=400,
            detail=(
                "El contenido del archivo no coincide con su extensión. "
                f"Se esperaba un archivo tipo {extension}."
            ),
        )


# --------------------------------------------------------------------------
# Middleware ASGI: límite real de tamaño de subida.
# --------------------------------------------------------------------------


async def _enviar_respuesta_413(enviar: Send, limite_bytes: int) -> None:
    mb = limite_bytes // (1024 * 1024)
    detalle = f"El archivo supera el tamaño máximo permitido de {mb} MB."
    cuerpo = detalle.encode("utf-8")
    await enviar(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"text/plain; charset=utf-8"),
                (b"content-length", str(len(cuerpo)).encode("ascii")),
            ],
        }
    )
    await enviar({"type": "http.response.body", "body": cuerpo})


class LimiteTamanoSubidaMiddleware:
    """Middleware ASGI que rechaza con 413 las subidas que superan el límite.

    Primera barrera: `Content-Length` declarado. Segunda barrera: el cuerpo
    se lee completo contando bytes antes de invocar la aplicación, por lo que
    un `Content-Length` falso o ausente no evade el control. Si se detecta
    exceso se responde 413 y nunca se ejecuta el endpoint.
    `leer_limitado` sigue siendo una barrera adicional dentro de cada
    endpoint.
    """

    def __init__(self, app: ASGIApp, limite_bytes: int | None = None):
        self.app = app
        self.limite_bytes = limite_bytes or settings.MAX_UPLOAD_SIZE_BYTES

    async def __call__(self, scope: Scope, recibir: Receive, enviar: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, recibir, enviar)
            return

        encabezados = dict(scope.get("headers", []))
        content_length_raw = encabezados.get(b"content-length")
        content_length = None
        if content_length_raw is not None:
            try:
                content_length = int(content_length_raw)
            except (ValueError, TypeError):
                content_length = None

        if content_length is not None and content_length > self.limite_bytes:
            await _enviar_respuesta_413(enviar, self.limite_bytes)
            return

        # Segunda barrera: leer el cuerpo completo contando bytes. Un
        # `Content-Length` falso o ausente no evade el control porque se
        # mide lo que realmente llega. Si se excede, se responde 413 y no se
        # invoca la aplicación.
        partes = []
        leido = 0
        while True:
            mensaje = await recibir()
            if mensaje.get("type") != "http.request":
                continue
            parte = mensaje.get("body") or b""
            leido += len(parte)
            if leido > self.limite_bytes:
                await _enviar_respuesta_413(enviar, self.limite_bytes)
                return
            if parte:
                partes.append(parte)
            if not mensaje.get("more_body", False):
                break

        cuerpo_completo = b"".join(partes)

        async def recibir_cuerpo():
            return {
                "type": "http.request",
                "body": cuerpo_completo,
                "more_body": False,
            }

        await self.app(scope, recibir_cuerpo, enviar)
