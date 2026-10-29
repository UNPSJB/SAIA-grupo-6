from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
    obtener,
    verificar_disponibilidad,
)
from src.common.texto import sin_tildes
from src.unidadMedida.models import UnidadMedida
from src.unidadMedida import schemas, exceptions

# `unidades_medida.nombre` y `.simbolo` son UNIQUE. El orden importa: primero
# el campo mas especifico, porque un mensaje del driver puede mentionar la
# tabla completa y no el column.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("unidades_medida.simbolo", exceptions.SimboloYaExiste),
    ("unidades_medida.nombre", exceptions.UnidadMedidaYaExiste),
    por_defecto=exceptions.DatoDuplicado,
)

_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(UnidadMedida.nombre),)),
    "nombre_desc": ColumnaOrden(
        (sin_tildes(UnidadMedida.nombre),), descendente=True
    ),
    "simbolo_asc": ColumnaOrden((sin_tildes(UnidadMedida.simbolo),)),
    "simbolo_desc": ColumnaOrden(
        (sin_tildes(UnidadMedida.simbolo),), descendente=True
    ),
}


def crear_unidad_medida(db: Session, datos: schemas.UnidadMedidaCreate) -> UnidadMedida:
    verificar_disponibilidad(
        db,
        UnidadMedida,
        "nombre",
        datos.nombre,
        ya_existe=exceptions.UnidadMedidaYaExiste,
        etiqueta="unidad de medida",
        femenina=True,
    )
    verificar_disponibilidad(
        db,
        UnidadMedida,
        "simbolo",
        datos.simbolo,
        ya_existe=exceptions.SimboloYaExiste,
        etiqueta="símbolo",
    )

    nueva_unidad = UnidadMedida(**datos.model_dump())
    db.add(nueva_unidad)
    return guardar(db, nueva_unidad, _MAPEA_CONFLICTO)


def _consulta_unidades_medida(
    incluir_inactivos: bool, buscar: Optional[str]
):
    """Consulta base compartida por el listado completo y el paginado."""
    consulta = select(UnidadMedida)

    filtro = filtro_busqueda(
        (UnidadMedida.nombre, UnidadMedida.simbolo), buscar
    )
    if filtro is not None:
        consulta = consulta.where(filtro)

    if not incluir_inactivos:
        consulta = consulta.where(UnidadMedida.activo.is_(True))

    return consulta


def listar_unidades_medida(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
) -> List[UnidadMedida]:
    consulta = _consulta_unidades_medida(incluir_inactivos, buscar).order_by(
        UnidadMedida.id
    )
    return list(db.scalars(consulta).all())


def listar_unidades_medida_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    orden: str = "nombre_asc",
) -> tuple[List[UnidadMedida], int]:
    """Mismo filtro que `listar_unidades_medida`, recortado en la base."""
    return paginar_consulta(
        db,
        _consulta_unidades_medida(incluir_inactivos, buscar),
        modelo=UnidadMedida,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def obtener_unidad_medida(db: Session, unidad_id: int) -> UnidadMedida:
    return obtener(db, UnidadMedida, unidad_id, exceptions.UnidadMedidaNoEncontrada)


def actualizar_unidad_medida(db: Session, unidad_id: int, datos: schemas.UnidadMedidaUpdate) -> UnidadMedida:
    unidad = obtener_unidad_medida(db, unidad_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    return aplicar_cambios(db, unidad, cambios, _MAPEA_CONFLICTO)


def eliminar_unidad_medida(db: Session, unidad_id: int) -> UnidadMedida:
    from src.insumos.models import Insumo
    from src.insumoQuimico.models import InsumoQuimico

    unidad = obtener_unidad_medida(db, unidad_id)

    # Validar que no esté en uso por insumos activos
    insumo_en_uso = db.scalar(
        select(Insumo).where(Insumo.unidad_medida_id == unidad_id, Insumo.activo == True)
    )
    if insumo_en_uso:
        raise exceptions.UnidadMedidaEnUso(
            mensaje=f"La unidad de medida '{unidad.nombre}' está en uso por el insumo '{insumo_en_uso.nombre}'."
        )

    # Validar que no esté en uso por insumos químicos activos
    insumo_quimico_en_uso = db.scalar(
        select(InsumoQuimico).where(InsumoQuimico.unidad_medida_id == unidad_id, InsumoQuimico.activo == True)
    )
    if insumo_quimico_en_uso:
        raise exceptions.UnidadMedidaEnUso(
            mensaje=f"La unidad de medida '{unidad.nombre}' está en uso por el insumo químico '{insumo_quimico_en_uso.nombre}'."
        )

    return baja_logica(db, unidad)
