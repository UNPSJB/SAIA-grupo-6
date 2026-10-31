from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.common.listados import filtro_busqueda

from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.proveedores import exceptions, schemas
from src.proveedores.models import Proveedor


_MAPEA_CONFLICTO = mapa_por_campo(
    ("proveedores.matricula", exceptions.MatriculaYaExiste),
    por_defecto=exceptions.MatriculaYaExiste,
)


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
    return guardar(db, proveedor, _MAPEA_CONFLICTO)


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
    return aplicar_cambios(db, proveedor, cambios, _MAPEA_CONFLICTO)


def eliminar_proveedor(db: Session, proveedor_id: int) -> Proveedor:
    return baja_logica(db, obtener_proveedor(db, proveedor_id))
