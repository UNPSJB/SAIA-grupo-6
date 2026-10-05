import logging
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.documentos import exceptions
from src.documentos.constants import (
    CARPETA_DOCUMENTOS,
    EXTENSIONES_PERMITIDAS,
    TAMANO_MAXIMO_BYTES,
    TipoDocumento,
)
from src.documentos.models import Documento, VersionDocumento
from src.personal.models import Personal

logger = logging.getLogger(__name__)


# ==========================================
# Helpers
# ==========================================


def _verificar_administrador(db: Session, usuario_id: int) -> Personal:
    """Verifica que el usuario exista, esté activo y tenga permiso de administrar."""
    usuario = db.scalar(select(Personal).where(Personal.id == usuario_id))
    if usuario is None:
        raise exceptions.UsuarioNoEncontrado()
    if not usuario.activo:
        raise exceptions.UsuarioInactivo()
    if not usuario.puede_administrar:
        raise exceptions.UsuarioSinPermisoDeAdministrar()
    return usuario


def _validar_archivo(archivo: UploadFile) -> str:
    """Valida extensión y tamaño. Devuelve la extensión en minúsculas (ej: '.pdf')."""
    extension = Path(archivo.filename or "").suffix.lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise exceptions.ArchivoExtensionInvalida()
    if not archivo.size:
        raise exceptions.ArchivoVacio()
    if archivo.size > TAMANO_MAXIMO_BYTES:
        raise exceptions.ArchivoMuyGrande()
    return extension


def _guardar_archivo(archivo: UploadFile, extension: str) -> str:
    """Guarda el archivo en disco con nombre único y devuelve su ruta relativa."""
    os.makedirs(CARPETA_DOCUMENTOS, exist_ok=True)
    ruta = f"{CARPETA_DOCUMENTOS}/{uuid.uuid4().hex}{extension}"
    with open(ruta, "wb") as destino:
        shutil.copyfileobj(archivo.file, destino)
    return ruta


def _borrar_archivo(ruta: str) -> None:
    """Solo para deshacer un guardado si falla el commit (evita archivos huérfanos)."""
    try:
        os.remove(ruta)
    except OSError:
        logger.warning("No se pudo borrar el archivo huérfano %s", ruta)


# ==========================================
# Historias 1 y 2 · Subir documento versionado / versión vigente
# ==========================================


def crear_documento(
    db: Session,
    nombre: str,
    tipo: TipoDocumento,
    autor_id: int,
    archivo: UploadFile,
) -> Documento:
    """Crea el documento con su versión 1, que queda vigente."""
    autor = _verificar_administrador(db, autor_id)

    nombre = nombre.strip()
    if not nombre:
        raise exceptions.NombreVacio()
    if db.scalar(select(Documento).where(Documento.nombre == nombre)):
        raise exceptions.DocumentoYaExiste()

    extension = _validar_archivo(archivo)
    ruta = _guardar_archivo(archivo, extension)
    ahora = datetime.now()

    try:
        documento = Documento(nombre=nombre, tipo=tipo.value)
        documento.versiones.append(
            VersionDocumento(
                numero_version=1,
                nombre_archivo=archivo.filename,
                archivo_url=ruta,
                vigente=True,
                vigente_desde=ahora,
                fecha_subida=ahora,
                autor_id=autor.id,
            )
        )
        db.add(documento)
        db.commit()
    except IntegrityError:
        db.rollback()
        _borrar_archivo(ruta)
        raise exceptions.DocumentoYaExiste()
    except Exception:
        db.rollback()
        _borrar_archivo(ruta)
        raise

    db.refresh(documento)
    return documento


def subir_nueva_version(
    db: Session,
    documento_id: int,
    autor_id: int,
    archivo: UploadFile,
) -> Documento:
    """Agrega la versión N+1 como VIGENTE y archiva la anterior (sin sobrescribir nada)."""
    autor = _verificar_administrador(db, autor_id)
    documento = leer_documento(db, documento_id)

    extension = _validar_archivo(archivo)
    ruta = _guardar_archivo(archivo, extension)
    ahora = datetime.now()

    try:
        numero = documento.proximo_numero_version
        anterior = documento.version_vigente

        if anterior is not None:
            anterior.vigente = False       # pasa a "archivada"
            anterior.vigente_hasta = ahora
            # flush para que la BD "suelte" la vigente anterior antes de insertar la nueva
            # (el índice único parcial solo admite una vigente por documento).
            db.flush()

        documento.versiones.append(
            VersionDocumento(
                numero_version=numero,
                nombre_archivo=archivo.filename,
                archivo_url=ruta,
                vigente=True,
                vigente_desde=ahora,
                fecha_subida=ahora,
                autor_id=autor.id,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        _borrar_archivo(ruta)
        raise exceptions.VersionConcurrente()
    except Exception:
        db.rollback()
        _borrar_archivo(ruta)
        raise

    db.refresh(documento)
    return documento


# ==========================================
# Lecturas
# ==========================================


def leer_documento(db: Session, documento_id: int) -> Documento:
    documento = db.scalar(select(Documento).where(Documento.id == documento_id))
    if documento is None:
        raise exceptions.DocumentoNoEncontrado()
    return documento


def listar_documentos(db: Session) -> list[Documento]:
    """Vista de gestión (administrador)."""
    return list(db.scalars(select(Documento).order_by(Documento.nombre)).all())


def listar_documentos_vigentes(
    db: Session,
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
) -> list[Documento]:
    """Historia 3: documentos con su versión vigente, con búsqueda por nombre y filtro por tipo."""
    consulta = select(Documento).order_by(Documento.nombre)
    if buscar and buscar.strip():
        consulta = consulta.where(Documento.nombre.ilike(f"%{buscar.strip()}%"))
    if tipo:
        consulta = consulta.where(Documento.tipo == tipo.value)

    documentos = db.scalars(consulta).all()
    return [d for d in documentos if d.version_vigente is not None]


def obtener_historial(db: Session, documento_id: int, usuario_id: int) -> Documento:
    """Historia 4: todas las versiones de un documento. Solo para administradores y solo lectura."""
    _verificar_administrador(db, usuario_id)
    return leer_documento(db, documento_id)