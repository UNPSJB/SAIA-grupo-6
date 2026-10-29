from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
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
from src.insumoQuimico.models import InsumoQuimico, TipoQuimico
from src.insumoQuimico import schemas, exceptions
from src.unidadMedida.models import UnidadMedida

# `insumos_quimicos.nombre` es UNIQUE: sin este mapeo un PUT con nombre
# repetido escapaba como 500 en vez de un 400 de negocio.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("insumos_quimicos.nombre", exceptions.InsumoQuimicoYaExiste),
    por_defecto=exceptions.DatoDuplicado,
)

_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(InsumoQuimico.nombre),)),
    "nombre_desc": ColumnaOrden(
        (sin_tildes(InsumoQuimico.nombre),), descendente=True
    ),
    "tipo_asc": ColumnaOrden((sin_tildes(InsumoQuimico.tipo),)),
    "tipo_desc": ColumnaOrden(
        (sin_tildes(InsumoQuimico.tipo),), descendente=True
    ),
    "unidad_asc": ColumnaOrden((sin_tildes(UnidadMedida.nombre),)),
    "unidad_desc": ColumnaOrden(
        (sin_tildes(UnidadMedida.nombre),), descendente=True
    ),
}


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


def _consulta_insumos_quimicos(
    incluir_inactivos: bool,
    buscar: Optional[str],
    tipo: Optional[TipoQuimico],
    unidad_medida_id: Optional[int],
):
    """Consulta base con el JOIN a la unidad, compartida por ambos caminos."""
    consulta = (
        select(InsumoQuimico)
        .join(InsumoQuimico.unidad_medida)
        .options(selectinload(InsumoQuimico.unidad_medida))
    )

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (
                    InsumoQuimico.nombre,
                    InsumoQuimico.tipo,
                    UnidadMedida.nombre,
                    UnidadMedida.simbolo,
                ),
                buscar,
            ),
            InsumoQuimico.tipo == tipo if tipo is not None else None,
            InsumoQuimico.unidad_medida_id == unidad_medida_id
            if unidad_medida_id
            else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if not incluir_inactivos:
        consulta = consulta.where(InsumoQuimico.activo.is_(True))

    return consulta


def listar_insumos_quimicos(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    tipo: Optional[TipoQuimico] = None,
    unidad_medida_id: Optional[int] = None,
) -> List[InsumoQuimico]:
    consulta = _consulta_insumos_quimicos(
        incluir_inactivos, buscar, tipo, unidad_medida_id
    ).order_by(InsumoQuimico.id)
    return list(db.scalars(consulta).all())


def listar_insumos_quimicos_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    tipo: Optional[TipoQuimico] = None,
    unidad_medida_id: Optional[int] = None,
    orden: str = "nombre_asc",
) -> tuple[List[InsumoQuimico], int]:
    """Mismo filtro que `listar_insumos_quimicos`, recortado en la base."""
    return paginar_consulta(
        db,
        _consulta_insumos_quimicos(
            incluir_inactivos, buscar, tipo, unidad_medida_id
        ),
        modelo=InsumoQuimico,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


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
