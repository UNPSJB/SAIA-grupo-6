from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.exceptions import ConflictoRegistroInactivo
from src.insumos.models import Insumo
from src.insumos import schemas, exceptions
from src.unidadMedida.models import UnidadMedida

_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Insumo.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Insumo.nombre),), descendente=True),
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

    _insumo = Insumo(**insumo.model_dump())
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
):
    """Consulta base con el JOIN a la unidad, compartida por ambos caminos."""
    consulta = (
        select(Insumo)
        .join(Insumo.unidad_medida)
        .options(selectinload(Insumo.unidad_medida))
    )

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
) -> List[Insumo]:
    consulta = _consulta_insumos(
        incluir_inactivos, buscar, unidad_medida_id
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
) -> tuple[List[Insumo], int]:
    """Mismo filtro que `listar_insumos`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_insumos(incluir_inactivos, buscar, unidad_medida_id),
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

    if datos_a_actualizar:
        try:
            db.execute(
                update(Insumo)
                .where(Insumo.id == insumo_id)
                .values(**datos_a_actualizar)
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise exceptions.InsumoYaExiste()
        except Exception:
            db.rollback()
            raise
        db.refresh(db_insumo)

    return db_insumo


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