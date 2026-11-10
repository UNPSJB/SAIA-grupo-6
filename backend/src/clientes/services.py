from typing import Optional
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.common.listados import filtro_busqueda
from src.common.paginacion import paginar
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    es_violacion_unica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.clientes import exceptions, schemas
from src.clientes.models import Cliente
from src.common.texto import sin_tildes

logger = logging.getLogger(__name__)


_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    ("clientes.documento", exceptions.ClienteYaExiste),
    por_defecto=exceptions.ClienteYaExiste,
)


def _mapear_conflicto_cliente(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en clientes (no es un duplicado): %s",
            mensaje,
        )
        raise IntegrityError("sin mapear", {}, Exception(mensaje))
    return _MAPEA_CONFLICTO_UNICO(mensaje)


def crear_cliente(db: Session, datos: schemas.ClienteCreate) -> Cliente:
    verificar_disponibilidad(
        db,
        Cliente,
        "documento",
        datos.documento,
        ya_existe=exceptions.ClienteYaExiste,
        etiqueta="cliente",
    )
    cliente = Cliente(**datos.model_dump())
    db.add(cliente)
    return guardar(db, cliente, _mapear_conflicto_cliente)


def listar_clientes(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    orden: str = "nombre_asc",
):
    """Lista clientes. Si se pasa `page` y `page_size`, devuelve paginación
    server-side `(items, total)`; si no, devuelve la lista completa."""
    consulta = select(Cliente)
    filtro = filtro_busqueda(
        (Cliente.nombre, Cliente.documento, Cliente.telefono, Cliente.email, Cliente.domicilio),
        buscar,
    )
    if filtro is not None:
        consulta = consulta.where(filtro)
    if not incluir_inactivos:
        consulta = consulta.where(Cliente.activo.is_(True))

    # Ordenamiento por columna (patrón igual al de insumos/incidentes)
    if orden == "nombre_asc":
        consulta = consulta.order_by(sin_tildes(Cliente.nombre).asc(), Cliente.id.asc())
    elif orden == "nombre_desc":
        consulta = consulta.order_by(sin_tildes(Cliente.nombre).desc(), Cliente.id.desc())
    elif orden == "documento_asc":
        consulta = consulta.order_by(Cliente.documento.asc(), Cliente.id.asc())
    elif orden == "documento_desc":
        consulta = consulta.order_by(Cliente.documento.desc(), Cliente.id.desc())
    else:
        consulta = consulta.order_by(sin_tildes(Cliente.nombre).asc(), Cliente.id.asc())

    if page is not None and page_size is not None:
        return paginar(db, consulta, page, page_size)

    return list(db.scalars(consulta).all())


def obtener_cliente(db: Session, cliente_id: int) -> Cliente:
    return obtener(db, Cliente, cliente_id, exceptions.ClienteNoEncontrado)


def actualizar_cliente(
    db: Session, cliente_id: int, datos: schemas.ClienteUpdate
) -> Cliente:
    cliente = obtener_cliente(db, cliente_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    # Nunca permitir que el cliente edite las fechas de auditoría.
    cambios.pop("fecha_creacion", None)
    cambios.pop("fecha_actualizacion", None)
    return aplicar_cambios(db, cliente, cambios, _mapear_conflicto_cliente)


def eliminar_cliente(db: Session, cliente_id: int) -> Cliente:
    return baja_logica(db, obtener_cliente(db, cliente_id))
