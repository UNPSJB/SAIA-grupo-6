import logging
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.common.fechas import ahora
from src.common.persistence import es_violacion_unica
from src.common.texto import normalizar_texto
from src.config import CARPETA_UPLOADS
from src.certificaciones_transportista import exceptions, schemas
from src.certificaciones_transportista.models import CertificacionTransportista
from src.transportistas.models import Transportista

logger = logging.getLogger(__name__)

CARPETA_CERTIFICACIONES = CARPETA_UPLOADS / "certificaciones_transportista"
CARPETA_CERTIFICACIONES.mkdir(parents=True, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".pdf", ".png", ".jpg", ".jpeg"}
TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB


def normalizar_tipo(tipo: str) -> str:
    """Clave interna para comparar tipos escritos de forma distinta.

    Recorta, colapsa espacios internos, pasa a minúsculas y quita tildes:
    "  Habilitación   Municipal " y "habilitacion municipal" son el mismo tipo.
    """
    return normalizar_texto(" ".join(tipo.split()))


def _obtener_transportista_o_error(db: Session, transportista_id: int) -> Transportista:
    stmt = select(Transportista).where(Transportista.id == transportista_id)
    transportista = db.scalar(stmt)
    if transportista is None:
        raise exceptions.TransportistaNoEncontrado()
    return transportista


def _guardar_archivo(archivo: UploadFile) -> str:
    """Guarda el archivo subido y devuelve la ruta relativa dentro de uploads/."""
    # `Path(...).name` descarta cualquier intento de salir de la carpeta
    # (por ejemplo "../../secretos.pdf") que venga en el nombre del archivo.
    nombre_original = Path(archivo.filename or "comprobante").name
    extension = Path(nombre_original).suffix.lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise exceptions.ArchivoInvalido()

    contenido = archivo.file.read()
    if len(contenido) > TAMANIO_MAXIMO_BYTES:
        raise exceptions.ArchivoDemasiadoGrande()

    # Dos comprobantes pueden llamarse igual ("certificado.pdf"). Se agrega un
    # sufijo corto en vez de pisar el archivo del registro anterior, que sigue
    # siendo descargable desde el historial.
    destino = CARPETA_CERTIFICACIONES / nombre_original
    if destino.exists():
        destino = CARPETA_CERTIFICACIONES / (
            f"{destino.stem}-{uuid4().hex[:8]}{extension}"
        )

    with open(destino, "wb") as archivo_destino:
        archivo_destino.write(contenido)

    return f"uploads/certificaciones_transportista/{destino.name}"


def crear_certificacion(
    db: Session,
    transportista_id: int,
    datos: schemas.CertificacionTransportistaCreate,
    archivo: Optional[UploadFile] = None,
) -> CertificacionTransportista:
    """Crea una certificación y renueva la anterior del mismo tipo, si existe.

    La renovación es la misma operación que un alta: si ya hay una activa con
    el mismo `tipo_normalizado`, se desactiva y se inserta la nueva en una
    única transacción. El índice único parcial de la base garantiza que nunca
    queden dos activas del mismo tipo.
    """
    _obtener_transportista_o_error(db, transportista_id)

    tipo_normalizado = normalizar_tipo(datos.tipo)
    previa = db.scalar(
        select(CertificacionTransportista).where(
            CertificacionTransportista.transportista_id == transportista_id,
            CertificacionTransportista.tipo_normalizado == tipo_normalizado,
            CertificacionTransportista.activa.is_(True),
        )
    )
    if previa is not None:
        previa.activa = False
        db.add(previa)
        # El flush hace el UPDATE antes del INSERT: sin esto, el índice único
        # parcial podría ver todavía la fila anterior como activa.
        db.flush()

    archivo_url = None
    if archivo is not None:
        archivo_url = _guardar_archivo(archivo)

    certificacion = CertificacionTransportista(
        transportista_id=transportista_id,
        tipo=datos.tipo,
        tipo_normalizado=tipo_normalizado,
        numero=datos.numero,
        fecha_emision=datos.fecha_emision,
        fecha_vencimiento=datos.fecha_vencimiento,
        observaciones=datos.observaciones,
        archivo_url=archivo_url,
        activa=True,
        anulada=False,
    )
    db.add(certificacion)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if es_violacion_unica(str(getattr(error, "orig", error)).lower()):
            raise exceptions.CertificacionYaActiva() from error
        raise

    db.refresh(certificacion)
    return certificacion


def listar_certificaciones(
    db: Session, transportista_id: int, incluir_historial: bool = False
) -> list[CertificacionTransportista]:
    _obtener_transportista_o_error(db, transportista_id)

    stmt = select(CertificacionTransportista).where(
        CertificacionTransportista.transportista_id == transportista_id
    )
    if not incluir_historial:
        stmt = stmt.where(CertificacionTransportista.activa.is_(True))
    stmt = stmt.order_by(
        CertificacionTransportista.fecha_vencimiento.desc(),
        CertificacionTransportista.id.desc(),
    )
    return list(db.scalars(stmt).all())


def obtener_certificacion(
    db: Session, certificacion_id: int
) -> CertificacionTransportista:
    stmt = select(CertificacionTransportista).where(
        CertificacionTransportista.id == certificacion_id
    )
    certificacion = db.scalar(stmt)
    if certificacion is None:
        raise exceptions.CertificacionTransportistaNoEncontrada()
    return certificacion


def actualizar_certificacion(
    db: Session,
    certificacion_id: int,
    datos: schemas.CertificacionTransportistaUpdate,
    archivo: Optional[UploadFile] = None,
) -> CertificacionTransportista:
    """Actualiza solo observaciones y, opcionalmente, el comprobante.

    El tipo, el número y las fechas son inmutables: para corregirlos hay que
    anular esta certificación y cargar una nueva.
    """
    certificacion = obtener_certificacion(db, certificacion_id)

    cambios = datos.model_dump(exclude_unset=True)
    campos_permitidos = {"observaciones"}
    if not set(cambios).issubset(campos_permitidos):
        raise exceptions.CertificacionInmutable()

    if archivo is not None:
        certificacion.archivo_url = _guardar_archivo(archivo)

    for clave, valor in cambios.items():
        setattr(certificacion, clave, valor)

    db.add(certificacion)
    db.commit()
    db.refresh(certificacion)
    return certificacion


def anular_certificacion(
    db: Session,
    certificacion_id: int,
    datos: schemas.CertificacionTransportistaAnular,
    usuario_id: Optional[int] = None,
) -> CertificacionTransportista:
    """Baja lógica con motivo, usuario y fecha. Nunca borra la fila."""
    certificacion = obtener_certificacion(db, certificacion_id)

    if certificacion.anulada:
        raise exceptions.CertificacionYaAnulada()

    motivo = (datos.motivo or "").strip()
    if not motivo:
        raise exceptions.MotivoAnulacionRequerido()

    certificacion.anulada = True
    certificacion.motivo_anulacion = motivo
    certificacion.anulada_por = (
        usuario_id if usuario_id is not None else db.info.get("usuario_id")
    )
    certificacion.fecha_anulacion = ahora()
    certificacion.activa = False

    db.add(certificacion)
    db.commit()
    db.refresh(certificacion)
    return certificacion


def obtener_ruta_archivo(certificacion: CertificacionTransportista) -> Optional[Path]:
    """Devuelve la ruta absoluta del archivo adjunto, o None si no tiene."""
    if not certificacion.archivo_url:
        return None
    # El archivo_url tiene formato "uploads/certificaciones_transportista/archivo.pdf"
    ruta_relativa = certificacion.archivo_url.replace("uploads/", "", 1)
    return CARPETA_UPLOADS / ruta_relativa
