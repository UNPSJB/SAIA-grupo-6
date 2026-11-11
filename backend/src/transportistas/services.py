from typing import Optional
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.common.listados import filtro_busqueda
from src.common.paginacion import paginar
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    es_violacion_unica,
    guardar,
    mapa_por_campo,
    verificar_disponibilidad,
)
from src.transportistas import exceptions, schemas
from src.transportistas.models import Transportista
from src.common.texto import sin_tildes

logger = logging.getLogger(__name__)


_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    ("transportistas.cuit", exceptions.TransportistaYaExiste),
    por_defecto=exceptions.TransportistaYaExiste,
)


def _mapear_conflicto_transportista(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en transportistas (no es un duplicado): %s",
            mensaje,
        )
        raise IntegrityError("sin mapear", {}, Exception(mensaje))
    return _MAPEA_CONFLICTO_UNICO(mensaje)


def crear_transportista(db: Session, datos: schemas.TransportistaCreate) -> Transportista:
    verificar_disponibilidad(
        db,
        Transportista,
        "cuit",
        datos.cuit,
        ya_existe=exceptions.TransportistaYaExiste,
        etiqueta="transportista",
    )
    transportista = Transportista(**datos.model_dump())
    db.add(transportista)
    return guardar(db, transportista, _mapear_conflicto_transportista)


def listar_transportistas(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    orden: str = "razon_social_asc",
):
    """Lista transportistas. Si se pasa `page` y `page_size`, devuelve paginación
    server-side `(items, total)`; si no, devuelve la lista completa."""
    # El estado de habilitación se calcula con las certificaciones: se cargan
    # en una segunda consulta (selectinload) para no hacer una por fila.
    consulta = select(Transportista).options(selectinload(Transportista.certificaciones))
    filtro = filtro_busqueda(
        (
            Transportista.razon_social,
            Transportista.cuit,
            Transportista.telefono,
            Transportista.email,
            Transportista.domicilio,
            Transportista.observaciones,
        ),
        buscar,
    )
    if filtro is not None:
        consulta = consulta.where(filtro)
    if not incluir_inactivos:
        consulta = consulta.where(Transportista.activo.is_(True))

    # Ordenamiento por columna (patrón igual al de clientes/insumos/incidentes)
    if orden == "razon_social_asc":
        consulta = consulta.order_by(
            sin_tildes(Transportista.razon_social).asc(), Transportista.id.asc()
        )
    elif orden == "razon_social_desc":
        consulta = consulta.order_by(
            sin_tildes(Transportista.razon_social).desc(), Transportista.id.desc()
        )
    elif orden == "cuit_asc":
        consulta = consulta.order_by(Transportista.cuit.asc(), Transportista.id.asc())
    elif orden == "cuit_desc":
        consulta = consulta.order_by(Transportista.cuit.desc(), Transportista.id.desc())
    else:
        consulta = consulta.order_by(
            sin_tildes(Transportista.razon_social).asc(), Transportista.id.asc()
        )

    if page is not None and page_size is not None:
        return paginar(db, consulta, page, page_size)

    return list(db.scalars(consulta).all())


def obtener_transportista(db: Session, transportista_id: int) -> Transportista:
    consulta = (
        select(Transportista)
        .options(selectinload(Transportista.certificaciones))
        .where(Transportista.id == transportista_id)
    )
    transportista = db.scalar(consulta)
    if transportista is None:
        raise exceptions.TransportistaNoEncontrado()
    return transportista


def actualizar_transportista(
    db: Session, transportista_id: int, datos: schemas.TransportistaUpdate
) -> Transportista:
    transportista = obtener_transportista(db, transportista_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    # Nunca permitir que el transportista edite las fechas de auditoría.
    cambios.pop("fecha_creacion", None)
    cambios.pop("fecha_actualizacion", None)
    return aplicar_cambios(db, transportista, cambios, _mapear_conflicto_transportista)


def eliminar_transportista(db: Session, transportista_id: int) -> Transportista:
    return baja_logica(db, obtener_transportista(db, transportista_id))
