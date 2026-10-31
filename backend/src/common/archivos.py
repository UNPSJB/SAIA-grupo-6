from pathlib import Path
import uuid
from fastapi import UploadFile, HTTPException
from src.config import CARPETA_UPLOADS


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

    # Nombre final
    nombre_archivo = f"{prefijo}_{uuid.uuid4().hex}{extension}"

    upload_dir = CARPETA_UPLOADS / subcarpeta
    upload_dir.mkdir(parents=True, exist_ok=True)

    ruta_relativa = f"uploads/{subcarpeta}/{nombre_archivo}"
    ruta_absoluta = upload_dir / nombre_archivo

    with open(ruta_absoluta, "wb") as f:
        f.write(contenido)

    return ruta_relativa
