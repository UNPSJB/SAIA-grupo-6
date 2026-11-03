from typing import List, Optional
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    es_violacion_unica,
    mapa_por_campo,
)
from src.common.texto import sin_tildes
from src.exceptions import ConflictoRegistroInactivo
from src.insumos.models import TIPO_INSUMO, Insumo
from src.insumos import schemas, exceptions
from src.unidadMedida.models import UnidadMedida

logger = logging.getLogger(__name__)

_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Insumo.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Insumo.nombre),), descendente=True),
    "unidad_asc": ColumnaOrden((sin_tildes(UnidadMedida.nombre),)),
    "unidad_desc": ColumnaOrden(
        (sin_tildes(UnidadMedida.nombre),), descendente=True
    ),
}

# `insumos.nombre` es UNIQUE: cualquier violación de integridad del PUT se
# traduce a "ya existe" (mismo criterio que tenía el update() de Core).
_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    por_defecto=exceptions.InsumoYaExiste,
)


def _mapear_conflicto_insumo(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en insumos (no es un duplicado): %s",
            mensaje,
        )
        raise IntegrityError("sin mapear", {}, Exception(mensaje))
    return _MAPEA_CONFLICTO_UNICO(mensaje)



def _verificar_unidad_medida(db: Session, unidad_medida_id: int) -> None:
    """Verifica que la unidad de medida exista y esté activa."""
    unidad = db.scalar(select(UnidadMedida).where(UnidadMedida.id == unidad_medida_id))
    if unidad is None:
        raise exceptions.UnidadMedidaNoExiste()
    if not unidad.activo:
        raise exceptions.UnidadMedidaInactiva()


def crear_insumo(db: Session, insumo: schemas.InsumoCreate) -> Insumo:
    existente = db.scalar(
        select(Insumo).where(Insumo.nombre == insumo.nombre)
    )
    if existente:
        if existente.activo:
            raise exceptions.InsumoYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"El insumo '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
                entidad_id=existente.id,
                campo="nombre"
            )

    _verificar_unidad_medida(db, insumo.unidad_medida_id)

    datos = insumo.model_dump()
    datos["tipo"] = TIPO_INSUMO
    _insumo = Insumo(**datos)
    db.add(_insumo)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(_insumo)
    return _insumo


def _consulta_insumos(
    incluir_inactivos: bool,
    buscar: Optional[str],
    unidad_medida_id: Optional[int],
    tipo: Optional[str] = TIPO_INSUMO,
):
    """Consulta base con el JOIN a la unidad, compartida por ambos caminos.

    `tipo=None` devuelve el maestro completo (insumos y productos), que es lo
    que necesita la pantalla de E1. Los listados internos siguen usando el
    default `insumo` para no mezclar productos donde se esperan insumos.
    """
    consulta = (
        select(Insumo)
        .join(Insumo.unidad_medida)
        .options(selectinload(Insumo.unidad_medida))
    )
    if tipo is not None:
        consulta = consulta.where(Insumo.tipo == tipo)

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (Insumo.nombre, UnidadMedida.nombre, UnidadMedida.simbolo),
                buscar,
            ),
            Insumo.unidad_medida_id == unidad_medida_id
            if unidad_medida_id
            else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if not incluir_inactivos:
        consulta = consulta.where(Insumo.activo.is_(True))

    return consulta


def listar_insumos(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    unidad_medida_id: Optional[int] = None,
    tipo: Optional[str] = TIPO_INSUMO,
) -> List[Insumo]:
    consulta = _consulta_insumos(
        incluir_inactivos, buscar, unidad_medida_id, tipo
    ).order_by(Insumo.id)
    return list(db.scalars(consulta).all())


def listar_insumos_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    unidad_medida_id: Optional[int] = None,
    orden: str = "nombre_asc",
    tipo: Optional[str] = TIPO_INSUMO,
) -> tuple[List[Insumo], int]:
    """Mismo filtro que `listar_insumos`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_insumos(incluir_inactivos, buscar, unidad_medida_id, tipo),
        modelo=Insumo,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def leer_insumo(db: Session, insumo_id: int) -> Insumo:
    db_insumo = db.scalar(select(Insumo).where(Insumo.id == insumo_id))
    if db_insumo is None:
        raise exceptions.InsumoNoEncontrado()
    return db_insumo


def modificar_insumo(
    db: Session, insumo_id: int, insumo: schemas.InsumoUpdate
) -> Insumo:
    db_insumo = leer_insumo(db, insumo_id)

    # Solo actualizamos los campos que realmente vinieron en el request
    # (evita pisar 'activo' u otros campos con NULL cuando no se envían).
    datos_a_actualizar = insumo.model_dump(exclude_unset=True)
    datos_a_actualizar = {
        campo: valor
        for campo, valor in datos_a_actualizar.items()
        if valor is not None
    }

    if not datos_a_actualizar:
        return db_insumo

    if "unidad_medida_id" in datos_a_actualizar:
        _verificar_unidad_medida(db, datos_a_actualizar["unidad_medida_id"])

    # Asignación por ORM y no un UPDATE de Core: los UPDATE de Core no
    # disparan eventos del ORM, así que la auditoría no los vería.
    return aplicar_cambios(db, db_insumo, datos_a_actualizar, _mapear_conflicto_insumo)


def eliminar_insumo(db: Session, insumo_id: int) -> Insumo:
    db_insumo = leer_insumo(db, insumo_id)
    db_insumo.activo = False
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(db_insumo)
    return db_insumo
