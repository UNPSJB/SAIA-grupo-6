from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.aditivos.models import Aditivo
from src.aditivos.services import resumen as resumen_aditivo
from src.insumos.models import TIPO_ADITIVO, TIPO_INGREDIENTE, Insumo
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas import exceptions, schemas
from src.recetas.models import (
    Receta,
    RecetaInsumo,
    TareaReceta,
    TareaRecetaInsumo,
    VersionReceta,
)
from src.unidadMedida.models import UnidadMedida

_CENTESIMA = Decimal("0.001")
_FACTOR = Decimal("0.000001")


def _q(valor: Decimal) -> Decimal:
    return Decimal(valor).quantize(_CENTESIMA)


def obtener_receta(db: Session, receta_id: int) -> Receta:
    receta = db.get(Receta, receta_id)
    if receta is None:
        raise exceptions.RecetaNoEncontrada()
    return receta


def version_vigente(db: Session, receta_id: int) -> VersionReceta | None:
    """La versión con el número más alto: la que se usa para lotes nuevos."""
    return db.scalar(
        select(VersionReceta)
        .where(VersionReceta.receta_id == receta_id)
        .order_by(VersionReceta.numero.desc())
        .limit(1)
    )


def obtener_version(db: Session, version_id: int) -> VersionReceta:
    version = db.scalar(
        select(VersionReceta)
        .where(VersionReceta.id == version_id)
        .options(
            selectinload(VersionReceta.unidad_medida),
            selectinload(VersionReceta.porcion_unidad_medida),
            selectinload(VersionReceta.insumos)
            .selectinload(RecetaInsumo.insumo)
            .selectinload(Insumo.aditivo)
            .selectinload(Aditivo.clase_funcional),
            selectinload(VersionReceta.insumos).selectinload(RecetaInsumo.unidad_medida),
            selectinload(VersionReceta.tareas)
            .selectinload(TareaReceta.insumos)
            .selectinload(TareaRecetaInsumo.receta_insumo)
            .selectinload(RecetaInsumo.insumo),
        )
    )
    if version is None:
        raise exceptions.VersionNoEncontrada()
    return version


def _validar_insumos(db: Session, datos: schemas.VersionRecetaIn) -> dict[int, Insumo]:
    if db.get(UnidadMedida, datos.unidad_medida_id) is None:
        raise exceptions.UnidadNoEncontrada()
    if datos.porcion_cantidad is not None and datos.porcion_unidad_medida_id is None:
        raise exceptions.PorcionSinUnidad()
    if datos.porcion_unidad_medida_id is not None:
        if datos.porcion_cantidad is None:
            raise exceptions.PorcionUnidadSinCantidad()
        if db.get(UnidadMedida, datos.porcion_unidad_medida_id) is None:
            raise exceptions.UnidadNoEncontrada()

    ids = [i.insumo_id for i in datos.insumos]
    if len(set(ids)) != len(ids):
        raise exceptions.InsumoRepetido()

    insumos = {
        i.id: i
        for i in db.scalars(
            select(Insumo)
            .where(Insumo.id.in_(ids), Insumo.activo.is_(True))
            .options(selectinload(Insumo.aditivo).selectinload(Aditivo.clase_funcional))
        ).all()
    }
    for item in datos.insumos:
        insumo = insumos.get(item.insumo_id)
        if insumo is None:
            raise exceptions.InsumoNoEncontrado()
        if insumo.unidad_medida_id != item.unidad_medida_id:
            raise exceptions.UnidadNoCoincide()
        # El CHECK de `insumos` ya lo impide; esto cubre datos viejos o editados a mano.
        if insumo.tipo == TIPO_ADITIVO and (
            insumo.aditivo is None or insumo.aditivo.clase_funcional is None
        ):
            raise exceptions.AditivoSinClase()
    if not any(i.tipo == TIPO_INGREDIENTE for i in insumos.values()):
        raise exceptions.SinIngredientes()
    return insumos


def _validar_reparto(datos: schemas.VersionRecetaIn) -> None:
    totales = {i.insumo_id: _q(i.cantidad) for i in datos.insumos}
    repartido: dict[int, Decimal] = {insumo_id: Decimal("0") for insumo_id in totales}
    for tarea in datos.tareas:
        vistos = set()
        for uso in tarea.insumos:
            if uso.insumo_id not in totales:
                raise exceptions.TareaInsumoDesconocido()
            if uso.insumo_id in vistos:
                raise exceptions.TareaInsumoRepetido()
            vistos.add(uso.insumo_id)
            repartido[uso.insumo_id] += _q(uso.cantidad)
    if any(repartido[i] != totales[i] for i in totales):
        raise exceptions.RepartoIncompleto()


def _armar_version(
    db: Session,
    receta: Receta,
    datos: schemas.VersionRecetaIn,
    usuario: Personal | None,
) -> VersionReceta:
    insumos = _validar_insumos(db, datos)
    _validar_reparto(datos)

    ultimo = db.scalar(
        select(func.max(VersionReceta.numero)).where(VersionReceta.receta_id == receta.id)
    )
    version = VersionReceta(
        receta=receta,
        numero=(ultimo or 0) + 1,
        rendimiento=datos.rendimiento,
        unidad_medida_id=datos.unidad_medida_id,
        porcion_descripcion=datos.porcion_descripcion,
        porcion_cantidad=datos.porcion_cantidad,
        porcion_unidad_medida_id=datos.porcion_unidad_medida_id,
        creado_por_id=usuario.id if usuario else None,
    )
    por_insumo = {
        item.insumo_id: RecetaInsumo(
            version=version,
            insumo=insumos[item.insumo_id],
            cantidad=item.cantidad,
            unidad_medida_id=item.unidad_medida_id,
            # Copia del tipo del maestro: la versión es inmutable y no debe
            # cambiar si después se reclasifica el insumo.
            clasificacion=insumos[item.insumo_id].tipo,
        )
        for item in datos.insumos
    }
    for orden, tarea_in in enumerate(datos.tareas, start=1):
        tarea = TareaReceta(version=version, orden=orden, descripcion=tarea_in.descripcion)
        for uso in tarea_in.insumos:
            TareaRecetaInsumo(
                tarea=tarea, receta_insumo=por_insumo[uso.insumo_id], cantidad=uso.cantidad
            )
    db.add(version)
    return version


def crear_receta(
    db: Session, datos: schemas.RecetaCreate, usuario: Personal | None = None
) -> Receta:
    producto = db.get(Producto, datos.producto_id)
    if producto is None or not producto.activo:
        raise exceptions.ProductoNoEncontrado()
    if db.scalar(select(Receta.id).where(Receta.producto_id == producto.id)) is not None:
        raise exceptions.RecetaYaExiste()

    receta = Receta(producto=producto)
    db.add(receta)
    try:
        _armar_version(db, receta, datos.version, usuario)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(receta)
    return receta


def crear_version(
    db: Session,
    receta_id: int,
    datos: schemas.VersionRecetaIn,
    usuario: Personal | None = None,
) -> VersionReceta:
    """Modificar una receta = crear una versión nueva. Las anteriores no se tocan."""
    receta = obtener_receta(db, receta_id)
    try:
        version = _armar_version(db, receta, datos, usuario)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return obtener_version(db, version.id)


def listar_recetas(db: Session, incluir_inactivas: bool = False) -> list[Receta]:
    consulta = select(Receta).options(selectinload(Receta.producto))
    if not incluir_inactivas:
        consulta = consulta.where(Receta.activo.is_(True))
    return list(db.scalars(consulta.order_by(Receta.id)).all())


def listar_versiones(db: Session, receta_id: int) -> list[VersionReceta]:
    obtener_receta(db, receta_id)
    return list(
        db.scalars(
            select(VersionReceta)
            .where(VersionReceta.receta_id == receta_id)
            .options(
                selectinload(VersionReceta.unidad_medida),
                selectinload(VersionReceta.porcion_unidad_medida),
            )
            .order_by(VersionReceta.numero)
        ).all()
    )


def a_respuesta(db: Session, receta: Receta) -> schemas.RecetaResponse:
    vigente = version_vigente(db, receta.id)
    return schemas.RecetaResponse(
        id=receta.id,
        producto_id=receta.producto_id,
        producto_nombre=receta.producto.nombre,
        activo=receta.activo,
        version_vigente=(
            schemas.VersionResumen.model_validate(vigente) if vigente else None
        ),
    )


def _aditivo_de(receta_insumo: RecetaInsumo):
    """Datos del aditivo (clase funcional, nombre completo, INS) si el renglón lo es."""
    if receta_insumo.clasificacion != TIPO_ADITIVO:
        return None
    return resumen_aditivo(receta_insumo.insumo.aditivo)


def _resumen_version(version: VersionReceta) -> dict:
    return {
        "id": version.id,
        "numero": version.numero,
        "rendimiento": version.rendimiento,
        "unidad_medida": schemas.UnidadResumen.model_validate(version.unidad_medida),
        "porcion_descripcion": version.porcion_descripcion,
        "porcion_cantidad": version.porcion_cantidad,
        "porcion_unidad_medida": (
            schemas.UnidadResumen.model_validate(version.porcion_unidad_medida)
            if version.porcion_unidad_medida
            else None
        ),
        "creado_en": version.creado_en,
        "creado_por_id": version.creado_por_id,
    }


def a_detalle(version: VersionReceta) -> schemas.VersionDetalle:
    return schemas.VersionDetalle(
        **_resumen_version(version),
        receta_id=version.receta_id,
        insumos=[
            schemas.RecetaInsumoResponse(
                id=i.id,
                insumo=schemas.InsumoResumen.model_validate(i.insumo),
                cantidad=i.cantidad,
                unidad_medida=schemas.UnidadResumen.model_validate(i.unidad_medida),
                clasificacion=i.clasificacion,
                aditivo=_aditivo_de(i),
            )
            for i in version.insumos
        ],
        tareas=[
            schemas.TareaRecetaResponse(
                id=t.id,
                orden=t.orden,
                descripcion=t.descripcion,
                insumos=[
                    schemas.TareaInsumoResponse(
                        receta_insumo_id=u.receta_insumo_id,
                        insumo=schemas.InsumoResumen.model_validate(u.receta_insumo.insumo),
                        cantidad=u.cantidad,
                    )
                    for u in t.insumos
                ],
            )
            for t in version.tareas
        ],
    )


# --------------------------------------------------------------------------
# Escalado: vista de cálculo, no modifica nada
# --------------------------------------------------------------------------

def calcular_factor(
    rendimiento: Decimal,
    cantidad_objetivo: Decimal | None,
    factor: Decimal | None,
) -> tuple[Decimal, Decimal]:
    """Devuelve (factor, cantidad_objetivo) a partir de uno de los dos.

    Exactamente uno tiene que venir: o se pide una cantidad de producto
    terminado o se multiplica la receta (duplicarla = factor 2).
    """
    if (cantidad_objetivo is None) == (factor is None):
        raise exceptions.EscaladoParametroInvalido()
    rendimiento = Decimal(rendimiento)
    if factor is not None:
        factor = Decimal(factor).quantize(_FACTOR)
        return factor, _q(rendimiento * factor)
    objetivo = _q(Decimal(cantidad_objetivo))
    return (objetivo / rendimiento).quantize(_FACTOR), objetivo


def escalar_receta(
    db: Session,
    receta_id: int,
    cantidad_objetivo: Decimal | None = None,
    factor: Decimal | None = None,
) -> schemas.RecetaEscalada:
    """Cantidades de la versión vigente multiplicadas por el factor.

    Cada cantidad queda en la unidad del insumo (la de la receta), así que el
    cálculo respeta las unidades. Es solo lectura: no toca la receta guardada.
    """
    receta = obtener_receta(db, receta_id)
    vigente = version_vigente(db, receta.id)
    if vigente is None:
        raise exceptions.RecetaSinVersion()
    version = obtener_version(db, vigente.id)
    factor, objetivo = calcular_factor(version.rendimiento, cantidad_objetivo, factor)

    def escalada(cantidad: Decimal) -> Decimal:
        return _q(Decimal(cantidad) * factor)

    return schemas.RecetaEscalada(
        receta_id=receta.id,
        producto_id=receta.producto_id,
        producto_nombre=receta.producto.nombre,
        version=schemas.VersionResumen(**_resumen_version(version)),
        factor=factor,
        cantidad_objetivo=objetivo,
        insumos=[
            schemas.InsumoEscalado(
                insumo=schemas.InsumoResumen.model_validate(i.insumo),
                clasificacion=i.clasificacion,
                aditivo=_aditivo_de(i),
                unidad_medida=schemas.UnidadResumen.model_validate(i.unidad_medida),
                cantidad_receta=i.cantidad,
                cantidad_escalada=escalada(i.cantidad),
            )
            for i in version.insumos
        ],
        tareas=[
            schemas.TareaEscalada(
                orden=t.orden,
                descripcion=t.descripcion,
                insumos=[
                    schemas.TareaInsumoEscalado(
                        insumo=schemas.InsumoResumen.model_validate(u.receta_insumo.insumo),
                        unidad_medida=schemas.UnidadResumen.model_validate(
                            u.receta_insumo.unidad_medida
                        ),
                        cantidad_receta=u.cantidad,
                        cantidad_escalada=escalada(u.cantidad),
                    )
                    for u in t.insumos
                ],
            )
            for t in version.tareas
        ],
    )
