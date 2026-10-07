from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    listar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.insumoQuimico.models import InsumoQuimico
from src.insumoQuimico import schemas, exceptions
from src.unidadMedida.models import UnidadMedida

# `insumos_quimicos.nombre` es UNIQUE: sin este mapeo un PUT con nombre
# repetido escapaba como 500 en vez de un 400 de negocio.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("insumos_quimicos.nombre", exceptions.InsumoQuimicoYaExiste),
    por_defecto=exceptions.DatoDuplicado,
)


def _verificar_unidad_medida(db: Session, unidad_medida_id: int) -> None:
    """Verifica que la unidad de medida exista y esté activa."""
    unidad = db.scalar(select(UnidadMedida).where(UnidadMedida.id == unidad_medida_id))
    if unidad is None:
        raise exceptions.UnidadMedidaNoExiste()
    if not unidad.activo:
        raise exceptions.UnidadMedidaInactiva()


def crear_insumo_quimico(db: Session, datos: schemas.InsumoQuimicoCreate) -> InsumoQuimico:
    verificar_disponibilidad(
        db,
        InsumoQuimico,
        "nombre",
        datos.nombre,
        ya_existe=exceptions.InsumoQuimicoYaExiste,
        etiqueta="insumo químico",
    )

    _verificar_unidad_medida(db, datos.unidad_medida_id)

    nuevo_insumo = InsumoQuimico(**datos.model_dump())
    db.add(nuevo_insumo)
    return guardar(db, nuevo_insumo, _MAPEA_CONFLICTO)


def listar_insumos_quimicos(db: Session, incluir_inactivos: bool = False) -> List[InsumoQuimico]:
    return listar(db, InsumoQuimico, incluir_inactivos=incluir_inactivos)


def obtener_insumo_quimico(db: Session, insumo_id: int) -> InsumoQuimico:
    return obtener(db, InsumoQuimico, insumo_id, exceptions.InsumoQuimicoNoEncontrado)


def listar_opciones_insumos(db: Session) -> List[schemas.InsumoQuimicoOpcion]:
    """Solo los datos necesarios para que el operario elija un producto
    químico al marcar su tarea del checklist."""
    filas = db.execute(
        select(InsumoQuimico.id, InsumoQuimico.nombre, UnidadMedida.simbolo)
        .join(UnidadMedida, InsumoQuimico.unidad_medida_id == UnidadMedida.id)
        .where(InsumoQuimico.activo.is_(True))
        .order_by(InsumoQuimico.nombre)
    ).all()

    return [
        schemas.InsumoQuimicoOpcion(id=id_, nombre=nombre, unidad_simbolo=simbolo)
        for id_, nombre, simbolo in filas
    ]


def actualizar_insumo_quimico(db: Session, insumo_id: int, datos: schemas.InsumoQuimicoUpdate) -> InsumoQuimico:
    insumo = obtener_insumo_quimico(db, insumo_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    if "unidad_medida_id" in cambios:
        _verificar_unidad_medida(db, cambios["unidad_medida_id"])

    return aplicar_cambios(db, insumo, cambios, _MAPEA_CONFLICTO)


def eliminar_insumo_quimico(db: Session, insumo_id: int) -> InsumoQuimico:
    return baja_logica(db, obtener_insumo_quimico(db, insumo_id))
