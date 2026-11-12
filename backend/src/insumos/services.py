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
from src.aditivos.models import Aditivo
from src.insumos.models import TIPO_ADITIVO, TIPO_INGREDIENTE, Insumo
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


def _validar_densidad_peso_por_tipo_unidad(
    db: Session,
    unidad_medida_id: int,
    densidad_g_ml: float | None,
    peso_unitario_g: float | None,
) -> None:
    """Valida que densidad/peso unitario estén presentes según el tipo de unidad.

    - Volumen -> densidad_g_ml es obligatoria.
    - Unidad  -> peso_unitario_g es obligatorio.
    """
    unidad = db.get(UnidadMedida, unidad_medida_id)
    if unidad is None:
        return  # ya falló antes en _verificar_unidad_medida

    if unidad.tipo == "volumen" and densidad_g_ml is None:
        raise exceptions.DensidadRequeridaParaVolumen()

    if unidad.tipo == "unidad" and peso_unitario_g is None:
        raise exceptions.PesoUnitarioRequeridoParaUnidad()


def _normalizar_tipo(db: Session, tipo: str, aditivo_id: Optional[int]) -> Optional[int]:
    """Devuelve el `aditivo_id` que corresponde al tipo.

    Un aditivo exige un aditivo activo de la lista de referencia (clase
    funcional, nombre completo e INS). Un ingrediente no lleva aditivo: si
    viene uno se descarta, así cambiar de aditivo a ingrediente lo limpia.
    """
    if tipo != TIPO_ADITIVO:
        return None
    if aditivo_id is None:
        raise exceptions.AditivoSinReferencia()
    aditivo = db.get(Aditivo, aditivo_id)
    if aditivo is None or not aditivo.activo or not aditivo.clase_funcional.activo:
        raise exceptions.AditivoNoValido()
    return aditivo.id


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
    _validar_densidad_peso_por_tipo_unidad(
        db, insumo.unidad_medida_id, insumo.densidad_g_ml, insumo.peso_unitario_g
    )

    datos = insumo.model_dump()
    datos["aditivo_id"] = _normalizar_tipo(db, insumo.tipo, insumo.aditivo_id)
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
    tipo: Optional[str] = None,
    solo_inactivos: bool = False,
):
    """Consulta base con el JOIN a la unidad, compartida por ambos caminos.

    `tipo=None` devuelve el maestro completo (ingredientes y aditivos).
    """
    consulta = (
        select(Insumo)
        .join(Insumo.unidad_medida)
        .options(
            selectinload(Insumo.unidad_medida),
            selectinload(Insumo.aditivo).selectinload(Aditivo.clase_funcional),
        )
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

    if solo_inactivos:
        consulta = consulta.where(Insumo.activo.is_(False))
    elif not incluir_inactivos:
        consulta = consulta.where(Insumo.activo.is_(True))

    return consulta


def listar_insumos(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    unidad_medida_id: Optional[int] = None,
    tipo: Optional[str] = None,
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
    tipo: Optional[str] = None,
    solo_inactivos: bool = False,
) -> tuple[List[Insumo], int]:
    """Mismo filtro que `listar_insumos`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_insumos(
            incluir_inactivos,
            buscar,
            unidad_medida_id,
            tipo,
            solo_inactivos=solo_inactivos,
        ),
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

    # Tipo y aditivo se validan juntos, sobre el estado final.
    if "tipo" in datos_a_actualizar or "aditivo_id" in datos_a_actualizar:
        tipo_final = datos_a_actualizar.get("tipo", db_insumo.tipo)
        datos_a_actualizar["tipo"] = tipo_final
        datos_a_actualizar["aditivo_id"] = _normalizar_tipo(
            db, tipo_final, datos_a_actualizar.get("aditivo_id", db_insumo.aditivo_id)
        )

    # Densidad y peso unitario se validan contra el tipo de unidad final.
    if any(
        c in datos_a_actualizar
        for c in ("unidad_medida_id", "densidad_g_ml", "peso_unitario_g")
    ):
        unidad_id_final = datos_a_actualizar.get(
            "unidad_medida_id", db_insumo.unidad_medida_id
        )
        densidad_final = datos_a_actualizar.get(
            "densidad_g_ml", db_insumo.densidad_g_ml
        )
        peso_final = datos_a_actualizar.get(
            "peso_unitario_g", db_insumo.peso_unitario_g
        )
        _validar_densidad_peso_por_tipo_unidad(
            db, unidad_id_final, densidad_final, peso_final
        )

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
