from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.common.listados import filtro_busqueda
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.productos import exceptions, schemas
from src.productos.models import Producto
from src.unidadMedida.models import UnidadMedida

_MAPEA_CONFLICTO_UNICO = mapa_por_campo(por_defecto=exceptions.ProductoYaExiste)


def _verificar_unidad(db: Session, unidad_medida_id: int) -> None:
    unidad = db.get(UnidadMedida, unidad_medida_id)
    if unidad is None:
        raise exceptions.UnidadMedidaNoExiste()
    if not unidad.activo:
        raise exceptions.UnidadMedidaInactiva()


def crear_producto(db: Session, datos: schemas.ProductoCreate) -> Producto:
    verificar_disponibilidad(
        db,
        Producto,
        "nombre",
        datos.nombre,
        ya_existe=exceptions.ProductoYaExiste,
        etiqueta="producto",
    )
    _verificar_unidad(db, datos.unidad_medida_id)
    producto = Producto(**datos.model_dump())
    db.add(producto)
    return guardar(db, producto, _MAPEA_CONFLICTO_UNICO)


def listar_productos(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> list[Producto]:
    consulta = select(Producto).options(selectinload(Producto.unidad_medida))
    filtro = filtro_busqueda((Producto.nombre,), buscar)
    if filtro is not None:
        consulta = consulta.where(filtro)
    if not incluir_inactivos:
        consulta = consulta.where(Producto.activo.is_(True))
    return list(db.scalars(consulta.order_by(Producto.nombre)).all())


def obtener_producto(db: Session, producto_id: int) -> Producto:
    return obtener(db, Producto, producto_id, exceptions.ProductoNoEncontrado)


def actualizar_producto(
    db: Session, producto_id: int, datos: schemas.ProductoUpdate
) -> Producto:
    producto = obtener_producto(db, producto_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if "unidad_medida_id" in cambios:
        _verificar_unidad(db, cambios["unidad_medida_id"])
    return aplicar_cambios(db, producto, cambios, _MAPEA_CONFLICTO_UNICO)


def eliminar_producto(db: Session, producto_id: int) -> Producto:
    return baja_logica(db, obtener_producto(db, producto_id))
