import logging
import os
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile
from sqlalchemy import and_, case, exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.common.listados import (
    ColumnaOrden,
    aplicar_orden,
    filtro_busqueda,
    paginar_consulta,
)
from src.common.texto import sin_tildes
from src.documentos import exceptions
from src.documentos.constants import (
    CARPETA_DOCUMENTOS,
    EXTENSIONES_PERMITIDAS,
    TAMANO_MAXIMO_BYTES,
    EstadoDocumentoFiltro,
    TipoDocumento,
)
from src.config import CARPETA_UPLOADS
from src.documentos.models import Documento, VersionDocumento
from src.personal.models import Personal

logger = logging.getLogger(__name__)


# Condición "el documento tiene una versión vigente". Es la misma regla que
# antes se resolvía en Python con `version_vigente`, pero en SQL: así el COUNT
# y el OFFSET/LIMIT no cargan documentos sin vigente.
_EXISTE_VERSION_VIGENTE = exists().where(
    VersionDocumento.documento_id == Documento.id,
    VersionDocumento.vigente.is_(True),
)

# Fecha de vencimiento de la versión vigente, como subconsulta escalar, para
# poder ordenar sin duplicar filas por cada versión archivada.
_VENCIMIENTO_VIGENTE = (
    select(VersionDocumento.fecha_vencimiento)
    .where(
        VersionDocumento.documento_id == Documento.id,
        VersionDocumento.vigente.is_(True),
    )
    .scalar_subquery()
)

_ORDENES_VIGENTES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Documento.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Documento.nombre),), descendente=True),
    "tipo_asc": ColumnaOrden((sin_tildes(Documento.tipo),)),
    "tipo_desc": ColumnaOrden((sin_tildes(Documento.tipo),), descendente=True),
    # Un documento sin fecha de vencimiento va al final en ambos sentidos: en
    # SQLite un NULL queda primero al ascender.
    "vencimiento_asc": ColumnaOrden((_VENCIMIENTO_VIGENTE,), nulos_al_final=True),
    "vencimiento_desc": ColumnaOrden(
        (_VENCIMIENTO_VIGENTE,), descendente=True, nulos_al_final=True
    ),
}

def _filtro_estado_documento(
    estado: Optional[EstadoDocumentoFiltro], *, exigir_version_vigente: bool
):
    """Predicado del filtro `estado`, con la MISMA regla que `VersionDocumento.estado`.

    `fecha_vencimiento` NULL o >= hoy es vigente; estrictamente anterior a hoy
    es vencido (un documento que vence hoy sigue vigente). En la vista de
    gestión un documento sin versión vigente no es ni vigente ni vencido:
    queda solo cuando no se filtra por estado, así que el `EXISTS` lo excluye.
    """
    if estado is None:
        return None

    hoy = date.today()
    if estado == "vencido":
        condicion = _VENCIMIENTO_VIGENTE < hoy
    else:
        condicion = or_(
            _VENCIMIENTO_VIGENTE.is_(None),
            _VENCIMIENTO_VIGENTE >= hoy,
        )

    if exigir_version_vigente:
        condicion = and_(_EXISTE_VERSION_VIGENTE, condicion)
    return condicion


def _orden_estado_documento():
    """Ranking del orden por estado de la vista de gestión.

    0 = vencido, 1 = vigente, 2 = sin versión vigente. Así `estado_asc` deja
    arriba lo urgente y `estado_desc` agrupa los documentos sin vigente.
    """
    return case(
        (~_EXISTE_VERSION_VIGENTE, 2),
        (_VENCIMIENTO_VIGENTE < date.today(), 0),
        else_=1,
    )


def _ordenes_documentos() -> dict[str, ColumnaOrden]:
    """Órdenes de la vista de gestión, con el `case` de estado por request.

    El ranking depende de `date.today()`, por eso no se puede congelar en una
    constante de módulo: un servidor que queda prendido varios días seguiría
    comparando contra la fecha del arranque.
    """
    estado = _orden_estado_documento()
    return {
        "nombre_asc": ColumnaOrden((sin_tildes(Documento.nombre),)),
        "nombre_desc": ColumnaOrden(
            (sin_tildes(Documento.nombre),), descendente=True
        ),
        "tipo_asc": ColumnaOrden((sin_tildes(Documento.tipo),)),
        "tipo_desc": ColumnaOrden((sin_tildes(Documento.tipo),), descendente=True),
        "estado_asc": ColumnaOrden((estado,)),
        "estado_desc": ColumnaOrden((estado,), descendente=True),
    }


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
    """Guarda el archivo en disco con nombre único y devuelve su ruta relativa.

    La carpeta se ancla a CARPETA_UPLOADS (raíz del backend) y no al
    directorio de trabajo: si el server se arranca desde otro lado, con ruta
    relativa el archivo se guardaría en un uploads distinto al que sirve
    GET /uploads y el documento daría 404.
    """
    carpeta = CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}{extension}"
    ruta = f"{CARPETA_DOCUMENTOS}/{nombre}"
    with open(carpeta / nombre, "wb") as destino:
        shutil.copyfileobj(archivo.file, destino)
    return ruta


def _borrar_archivo(ruta: str) -> None:
    """Solo para deshacer un guardado si falla el commit (evita archivos huérfanos)."""
    ruta_absoluta = CARPETA_UPLOADS / ruta[len("uploads/"):]
    try:
        os.remove(ruta_absoluta)
    except OSError:
        logger.warning("No se pudo borrar el archivo huérfano %s", ruta)



def crear_documento(
    db: Session,
    nombre: str,
    tipo: TipoDocumento,
    autor_id: int,
    archivo: UploadFile,
    fecha_vencimiento: Optional[date] = None,
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
                fecha_vencimiento=fecha_vencimiento,
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
    fecha_vencimiento: Optional[date] = None
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
                fecha_vencimiento=fecha_vencimiento,
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



def leer_documento(db: Session, documento_id: int) -> Documento:
    documento = db.scalar(select(Documento).where(Documento.id == documento_id))
    if documento is None:
        raise exceptions.DocumentoNoEncontrado()
    return documento


def _consulta_documentos(
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
    estado: Optional[EstadoDocumentoFiltro] = None,
):
    """Vista de gestión: todos los documentos, filtrados en SQL."""
    consulta = select(Documento)

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda((Documento.nombre, Documento.tipo), buscar),
            Documento.tipo == tipo.value if tipo else None,
            _filtro_estado_documento(estado, exigir_version_vigente=True),
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    return consulta


def listar_documentos(
    db: Session,
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
    orden: str = "nombre_asc",
    estado: Optional[EstadoDocumentoFiltro] = None,
) -> list[Documento]:
    """Vista de gestión (administrador)."""
    consulta = aplicar_orden(
        _consulta_documentos(buscar, tipo, estado),
        Documento,
        orden,
        _ordenes_documentos(),
        "nombre_asc",
    )
    return list(db.scalars(consulta).all())


def listar_documentos_paginado(
    db: Session,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
    orden: str = "nombre_asc",
    estado: Optional[EstadoDocumentoFiltro] = None,
) -> tuple[list[Documento], int]:
    """Mismo listado que `listar_documentos`, recortado en la base.

    `Documento.nombre` es UNIQUE, pero el desempate por `id` igual deja el
    orden determinista ante cualquier cambio del modelo.
    """
    return paginar_consulta(
        db,
        _consulta_documentos(buscar, tipo, estado),
        modelo=Documento,
        orden=orden,
        ordenes=_ordenes_documentos(),
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def _consulta_documentos_vigentes(
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
    estado: Optional[EstadoDocumentoFiltro] = None,
):
    """Documentos con versión vigente, con búsqueda y tipo resueltos en SQL."""
    consulta = select(Documento).where(_EXISTE_VERSION_VIGENTE)

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda((Documento.nombre, Documento.tipo), buscar),
            Documento.tipo == tipo.value if tipo else None,
            _filtro_estado_documento(estado, exigir_version_vigente=False),
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    return consulta


def listar_documentos_vigentes(
    db: Session,
    buscar: Optional[str] = None,
    tipo: Optional[TipoDocumento] = None,
    orden: str = "nombre_asc",
    estado: Optional[EstadoDocumentoFiltro] = None,
) -> list[Documento]:
    """Historia 3: documentos con su versión vigente.

    El filtro "tiene versión vigente" se resuelve con el `EXISTS` compartido
    con la versión paginada, así el camino completo y el paginado devuelven
    exactamente el mismo conjunto.
    """
    consulta = aplicar_orden(
        _consulta_documentos_vigentes(buscar, tipo, estado),
        Documento,
        orden,
        _ORDENES_VIGENTES,
        "nombre_asc",
    )
    return list(db.scalars(consulta).all())


def listar_documentos_vigentes_paginado(
    db: Session,
    buscar: Optional[str],
    tipo: Optional[TipoDocumento],
    page: int,
    page_size: int,
    orden: str = "nombre_asc",
    estado: Optional[EstadoDocumentoFiltro] = None,
) -> tuple[list[Documento], int]:
    """Página de documentos vigentes, con los filtros resueltos en SQL.

    La condición "tiene versión vigente" —que la lista completa resolvía con
    la propiedad Python `version_vigente`— acá se expresa con un `EXISTS`
    sobre `VersionDocumento`, así que el COUNT y el OFFSET/LIMIT los hace
    la base y no se cargan documentos de más. `buscar` usa `filtro_busqueda`
    (sin mayúsculas ni tildes) y `tipo` es columna directa: también en el
    WHERE. El orden por vencimiento usa una subconsulta escalar a la versión
    vigente, sin duplicar filas por las versiones archivadas.
    """
    return paginar_consulta(
        db,
        _consulta_documentos_vigentes(buscar, tipo, estado),
        modelo=Documento,
        orden=orden,
        ordenes=_ORDENES_VIGENTES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def obtener_historial(db: Session, documento_id: int, usuario_id: int) -> Documento:
    """Historia 4: todas las versiones de un documento. Solo para administradores y solo lectura."""
    _verificar_administrador(db, usuario_id)
    return leer_documento(db, documento_id)