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
from src.aditivos.models import ClaseFuncional
from src.ingredientes.models import Ingrediente
from src.proveedores.models import Proveedor
from src.ingredientes import schemas, exceptions
from src.unidadMedida.models import UnidadMedida

logger = logging.getLogger(__name__)

_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(Ingrediente.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(Ingrediente.nombre),), descendente=True),
    "unidad_asc": ColumnaOrden((sin_tildes(UnidadMedida.nombre),)),
    "unidad_desc": ColumnaOrden(
        (sin_tildes(UnidadMedida.nombre),), descendente=True
    ),
}

# `ingredientes.nombre` es UNIQUE: cualquier violación de integridad del PUT se
# traduce a "ya existe" (mismo criterio que tenía el update() de Core).
_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    por_defecto=exceptions.IngredienteYaExiste,
)


def _mapear_conflicto_ingrediente(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en ingredientes (no es un duplicado): %s",
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


def _normalizar_aditivo(
    db: Session,
    es_aditivo: bool,
    clase_funcional_id: Optional[int],
    numero_ins: Optional[str],
    excepto_id: Optional[int] = None,
) -> tuple[Optional[int], Optional[str]]:
    """(clase_funcional_id, numero_ins) que corresponden según `es_aditivo`.

    Un aditivo exige una clase funcional activa, y el INS salvo que la clase lo
    tenga como opcional. Un ingrediente que no es aditivo no lleva ninguno de
    los dos: si vienen se descartan, así desmarcarlo los limpia.
    """
    if not es_aditivo:
        return None, None
    if clase_funcional_id is None:
        raise exceptions.AditivoSinClase()
    clase = db.get(ClaseFuncional, clase_funcional_id)
    if clase is None or not clase.activo:
        raise exceptions.ClaseFuncionalNoValida()
    if numero_ins is None and not clase.ins_opcional:
        raise exceptions.InsObligatorio()
    if numero_ins is not None:
        # El INS identifica al aditivo: no puede haber dos ingredientes con el
        # mismo (las marcas van como insumos). Cuenta también uno dado de baja.
        consulta = select(Ingrediente).where(Ingrediente.numero_ins == numero_ins)
        if excepto_id is not None:
            consulta = consulta.where(Ingrediente.id != excepto_id)
        otro = db.scalar(consulta)
        if otro is not None:
            raise exceptions.InsRepetido(otro.nombre, otro.activo)
    return clase.id, numero_ins


def crear_ingrediente(db: Session, ingrediente: schemas.IngredienteCreate) -> Ingrediente:
    existente = db.scalar(
        select(Ingrediente).where(Ingrediente.nombre == ingrediente.nombre)
    )
    if existente:
        if existente.activo:
            raise exceptions.IngredienteYaExiste()
        else:
            raise ConflictoRegistroInactivo(
                mensaje=f"El ingrediente '{existente.nombre}' ya existe pero está dado de baja. ¿Querés reactivarlo con estos nuevos datos?",
                entidad_id=existente.id,
                campo="nombre"
            )

    _verificar_unidad_medida(db, ingrediente.unidad_medida_id)
    _validar_densidad_peso_por_tipo_unidad(
        db, ingrediente.unidad_medida_id, ingrediente.densidad_g_ml, ingrediente.peso_unitario_g
    )

    datos = ingrediente.model_dump()
    datos["clase_funcional_id"], datos["numero_ins"] = _normalizar_aditivo(
        db, ingrediente.es_aditivo, ingrediente.clase_funcional_id, ingrediente.numero_ins
    )
    _ingrediente = Ingrediente(**datos)
    db.add(_ingrediente)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(_ingrediente)
    return _ingrediente


def _consulta_ingredientes(
    incluir_inactivos: bool,
    buscar: Optional[str],
    unidad_medida_id: Optional[int],
    es_aditivo: Optional[bool] = None,
    solo_inactivos: bool = False,
    proveedor_id: Optional[int] = None,
):
    """Consulta base con el JOIN a la unidad, compartida por ambos caminos.

    `es_aditivo=None` devuelve el maestro completo (aditivos incluidos).
    """
    consulta = (
        select(Ingrediente)
        .join(Ingrediente.unidad_medida)
        .options(
            selectinload(Ingrediente.unidad_medida),
            selectinload(Ingrediente.clase_funcional),
            selectinload(Ingrediente.proveedores),
        )
    )
    if es_aditivo is not None:
        consulta = consulta.where(Ingrediente.es_aditivo.is_(es_aditivo))
    if proveedor_id is not None:
        consulta = consulta.where(Ingrediente.proveedores.any(Proveedor.id == proveedor_id))

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (Ingrediente.nombre, UnidadMedida.nombre, UnidadMedida.simbolo),
                buscar,
            ),
            Ingrediente.unidad_medida_id == unidad_medida_id
            if unidad_medida_id
            else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if solo_inactivos:
        consulta = consulta.where(Ingrediente.activo.is_(False))
    elif not incluir_inactivos:
        consulta = consulta.where(Ingrediente.activo.is_(True))

    return consulta


def listar_ingredientes(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    unidad_medida_id: Optional[int] = None,
    es_aditivo: Optional[bool] = None,
    proveedor_id: Optional[int] = None,
) -> List[Ingrediente]:
    consulta = _consulta_ingredientes(
        incluir_inactivos, buscar, unidad_medida_id, es_aditivo, proveedor_id=proveedor_id
    ).order_by(Ingrediente.id)
    return list(db.scalars(consulta).all())


def listar_ingredientes_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    unidad_medida_id: Optional[int] = None,
    orden: str = "nombre_asc",
    es_aditivo: Optional[bool] = None,
    solo_inactivos: bool = False,
    proveedor_id: Optional[int] = None,
) -> tuple[List[Ingrediente], int]:
    """Mismo filtro que `listar_ingredientes`, recortado en la base: página + total."""
    return paginar_consulta(
        db,
        _consulta_ingredientes(
            incluir_inactivos,
            buscar,
            unidad_medida_id,
            es_aditivo,
            solo_inactivos=solo_inactivos,
            proveedor_id=proveedor_id,
        ),
        modelo=Ingrediente,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


def leer_ingrediente(db: Session, ingrediente_id: int) -> Ingrediente:
    db_ingrediente = db.scalar(select(Ingrediente).where(Ingrediente.id == ingrediente_id).options(selectinload(Ingrediente.proveedores)))
    if db_ingrediente is None:
        raise exceptions.IngredienteNoEncontrado()
    return db_ingrediente


def _tiene_cantidades(db: Session, ingrediente_id: int) -> bool:
    """Hay lotes o renglones de receta con cantidades en la unidad del ingrediente."""
    from src.lotesInsumo.models import LoteInsumo
    from src.recetas.models import RecetaIngrediente

    return any(
        db.scalar(select(modelo.id).where(modelo.ingrediente_id == ingrediente_id).limit(1)) is not None
        for modelo in (LoteInsumo, RecetaIngrediente)
    )


def modificar_ingrediente(
    db: Session, ingrediente_id: int, ingrediente: schemas.IngredienteUpdate
) -> Ingrediente:
    db_ingrediente = leer_ingrediente(db, ingrediente_id)

    # Solo actualizamos los campos que realmente vinieron en el request
    # (evita pisar 'activo' u otros campos con NULL cuando no se envían).
    datos_a_actualizar = ingrediente.model_dump(exclude_unset=True)
    datos_a_actualizar = {
        campo: valor
        for campo, valor in datos_a_actualizar.items()
        # numero_ins en null sí cuenta: borra el INS.
        if valor is not None or campo == "numero_ins"
    }

    if not datos_a_actualizar:
        return db_ingrediente

    if "unidad_medida_id" in datos_a_actualizar:
        _verificar_unidad_medida(db, datos_a_actualizar["unidad_medida_id"])
        if datos_a_actualizar["unidad_medida_id"] != db_ingrediente.unidad_medida_id and _tiene_cantidades(
            db, db_ingrediente.id
        ):
            raise exceptions.UnidadEnUso()

    # La marca de aditivo, su clase e INS se validan juntos, sobre el estado final.
    if {"es_aditivo", "clase_funcional_id", "numero_ins"} & datos_a_actualizar.keys():
        es_aditivo_final = datos_a_actualizar.get("es_aditivo", db_ingrediente.es_aditivo)
        datos_a_actualizar["es_aditivo"] = es_aditivo_final
        (
            datos_a_actualizar["clase_funcional_id"],
            datos_a_actualizar["numero_ins"],
        ) = _normalizar_aditivo(
            db,
            es_aditivo_final,
            datos_a_actualizar.get("clase_funcional_id", db_ingrediente.clase_funcional_id),
            datos_a_actualizar.get("numero_ins", db_ingrediente.numero_ins),
            excepto_id=db_ingrediente.id,
        )

    # Densidad y peso unitario se validan contra el tipo de unidad final.
    if any(
        c in datos_a_actualizar
        for c in ("unidad_medida_id", "densidad_g_ml", "peso_unitario_g")
    ):
        unidad_id_final = datos_a_actualizar.get(
            "unidad_medida_id", db_ingrediente.unidad_medida_id
        )
        densidad_final = datos_a_actualizar.get(
            "densidad_g_ml", db_ingrediente.densidad_g_ml
        )
        peso_final = datos_a_actualizar.get(
            "peso_unitario_g", db_ingrediente.peso_unitario_g
        )
        _validar_densidad_peso_por_tipo_unidad(
            db, unidad_id_final, densidad_final, peso_final
        )

    # Asignación por ORM y no un UPDATE de Core: los UPDATE de Core no
    # disparan eventos del ORM, así que la auditoría no los vería.
    return aplicar_cambios(db, db_ingrediente, datos_a_actualizar, _mapear_conflicto_ingrediente)


def eliminar_ingrediente(db: Session, ingrediente_id: int) -> Ingrediente:
    db_ingrediente = leer_ingrediente(db, ingrediente_id)
    db_ingrediente.activo = False
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(db_ingrediente)
    return db_ingrediente