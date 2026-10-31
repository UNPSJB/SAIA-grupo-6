from typing import Optional
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.common.listados import filtro_busqueda

from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    es_violacion_unica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.proveedores import exceptions, schemas
from src.proveedores.models import Proveedor

logger = logging.getLogger(__name__)


_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    ("proveedores.matricula", exceptions.MatriculaYaExiste),
    por_defecto=exceptions.MatriculaYaExiste,
)


def _mapear_conflicto_proveedor(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en proveedores (no es un duplicado): %s",
            mensaje,
        )
        raise IntegrityError("sin mapear", {}, Exception(mensaje))
    return _MAPEA_CONFLICTO_UNICO(mensaje)


def crear_proveedor(db: Session, datos: schemas.ProveedorCreate) -> Proveedor:
    verificar_disponibilidad(
        db,
        Proveedor,
        "matricula",
        datos.matricula,
        ya_existe=exceptions.MatriculaYaExiste,
        etiqueta="proveedor",
    )
    proveedor = Proveedor(**datos.model_dump())
    db.add(proveedor)
    return guardar(db, proveedor, _mapear_conflicto_proveedor)


def listar_proveedores(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> list[Proveedor]:
    consulta = select(Proveedor)
    filtro = filtro_busqueda((Proveedor.nombre, Proveedor.matricula), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)
    if not incluir_inactivos:
        consulta = consulta.where(Proveedor.activo.is_(True))

    return list(db.scalars(consulta.order_by(Proveedor.id)).all())


def obtener_proveedor(db: Session, proveedor_id: int) -> Proveedor:
    return obtener(db, Proveedor, proveedor_id, exceptions.ProveedorNoEncontrado)


def actualizar_proveedor(
    db: Session, proveedor_id: int, datos: schemas.ProveedorUpdate
) -> Proveedor:
    proveedor = obtener_proveedor(db, proveedor_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    return aplicar_cambios(db, proveedor, cambios, _mapear_conflicto_proveedor)


def eliminar_proveedor(db: Session, proveedor_id: int) -> Proveedor:
    return baja_logica(db, obtener_proveedor(db, proveedor_id))
