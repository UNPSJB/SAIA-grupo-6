from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from src.common.listados import ColumnaOrden, aplicar_orden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.insumoQuimico import exceptions, schemas
from src.insumoQuimico.models import (
    InsumoQuimico,
    LoteStock,
    MovimientoStockInsumoQuimico,
    StockInsumoQuimico,
    TipoMovimientoStock,
)
from src.personal.models import Personal
from src.proveedores.models import Proveedor
from src.unidadMedida.models import UnidadMedida


def _nombre_persona(usuario: Personal) -> str:
    return f"{usuario.nombre} {usuario.apellido or ''}".strip()


def _obtener_insumo_activo(
    db: Session, insumo_id: int, *, permitir_inactivo: bool = False
) -> InsumoQuimico:
    insumo = db.get(InsumoQuimico, insumo_id)
    if insumo is None or (not permitir_inactivo and not insumo.activo):
        raise exceptions.InsumoQuimicoNoEncontrado()
    return insumo


def _asegurar_stock(db: Session, insumo_id: int) -> StockInsumoQuimico:
    stock = db.get(StockInsumoQuimico, insumo_id)
    if stock is None:
        stock = StockInsumoQuimico(insumo_quimico_id=insumo_id)
        db.add(stock)
        db.flush()
    return stock


def _obtener_proveedor_activo(db: Session, proveedor_id: int) -> Proveedor:
    proveedor = db.get(Proveedor, proveedor_id)
    if proveedor is None or not proveedor.activo:
        raise exceptions.ProveedorIngresoInvalido()
    return proveedor


def _aplicar_variacion(db: Session, insumo_id: int, variacion: Decimal) -> None:
    _asegurar_stock(db, insumo_id)
    condicion = StockInsumoQuimico.cantidad_actual + variacion >= 0
    resultado = db.execute(
        update(StockInsumoQuimico)
        .where(
            StockInsumoQuimico.insumo_quimico_id == insumo_id,
            condicion,
        )
        .values(cantidad_actual=StockInsumoQuimico.cantidad_actual + variacion)
    )
    if resultado.rowcount != 1:
        raise exceptions.StockInsuficiente()


def _movimiento(
    *,
    insumo: InsumoQuimico,
    variacion: Decimal,
    tipo: TipoMovimientoStock,
    usuario_id: Optional[int],
    usuario_nombre: Optional[str],
    motivo: Optional[str] = None,
    checklist_id: Optional[int] = None,
    registro_tarea_id: Optional[int] = None,
    checklist_fecha: Optional[date] = None,
    tarea_nombre: Optional[str] = None,
) -> MovimientoStockInsumoQuimico:
    return MovimientoStockInsumoQuimico(
        insumo_quimico_id=insumo.id,
        cantidad_variacion=variacion,
        tipo=tipo,
        motivo=motivo,
        responsable_id=usuario_id,
        responsable_nombre=usuario_nombre,
        checklist_id=checklist_id,
        registro_tarea_id=registro_tarea_id,
        checklist_fecha=checklist_fecha,
        tarea_nombre=tarea_nombre,
        nombre_producto=insumo.nombre,
        unidad_simbolo=insumo.unidad_medida.simbolo if insumo.unidad_medida else None,
    )


def _respuesta_stock_desde(
    insumo: InsumoQuimico, stock: StockInsumoQuimico
) -> schemas.StockInsumoQuimicoResponse:
    minimo = stock.stock_minimo
    cantidad = stock.cantidad_actual
    return schemas.StockInsumoQuimicoResponse(
        insumo_quimico_id=insumo.id,
        nombre=insumo.nombre,
        unidad_medida_id=insumo.unidad_medida_id,
        unidad_simbolo=insumo.unidad_medida.simbolo if insumo.unidad_medida else None,
        activo=insumo.activo,
        cantidad_actual=cantidad,
        stock_minimo=minimo,
        stock_bajo=minimo is not None and cantidad < minimo,
    )


def _respuesta_stock(db: Session, insumo_id: int) -> schemas.StockInsumoQuimicoResponse:
    insumo = db.get(InsumoQuimico, insumo_id)
    stock = db.get(StockInsumoQuimico, insumo_id)
    return _respuesta_stock_desde(insumo, stock)


_ORDENES_STOCK = {
    "nombre_asc": ColumnaOrden((sin_tildes(InsumoQuimico.nombre),)),
    "nombre_desc": ColumnaOrden((sin_tildes(InsumoQuimico.nombre),), descendente=True),
    "cantidad_asc": ColumnaOrden((StockInsumoQuimico.cantidad_actual,)),
    "cantidad_desc": ColumnaOrden((StockInsumoQuimico.cantidad_actual,), descendente=True),
    "minimo_asc": ColumnaOrden((StockInsumoQuimico.stock_minimo,), nulos_al_final=True),
    "minimo_desc": ColumnaOrden(
        (StockInsumoQuimico.stock_minimo,), descendente=True, nulos_al_final=True
    ),
}


def _consulta_stock(
    buscar: Optional[str], stock_bajo: Optional[bool]
):
    consulta = (
        select(InsumoQuimico)
        .join(StockInsumoQuimico)
        .join(UnidadMedida)
        .options(selectinload(InsumoQuimico.unidad_medida))
        .where(InsumoQuimico.activo.is_(True))
    )
    filtros = [
        filtro_busqueda(
            (InsumoQuimico.nombre, UnidadMedida.nombre, UnidadMedida.simbolo), buscar
        )
    ]
    if stock_bajo is True:
        filtros.extend(
            (
                StockInsumoQuimico.stock_minimo.is_not(None),
                StockInsumoQuimico.cantidad_actual < StockInsumoQuimico.stock_minimo,
            )
        )
    elif stock_bajo is False:
        filtros.append(
            (StockInsumoQuimico.stock_minimo.is_(None))
            | (StockInsumoQuimico.cantidad_actual >= StockInsumoQuimico.stock_minimo)
        )
    return consulta, [filtro for filtro in filtros if filtro is not None]


def _respuestas_stock(
    db: Session, insumos: list[InsumoQuimico]
) -> list[schemas.StockInsumoQuimicoResponse]:
    if not insumos:
        return []
    saldos = {
        stock.insumo_quimico_id: stock
        for stock in db.scalars(
            select(StockInsumoQuimico).where(
                StockInsumoQuimico.insumo_quimico_id.in_([insumo.id for insumo in insumos])
            )
        ).all()
    }
    return [_respuesta_stock_desde(insumo, saldos[insumo.id]) for insumo in insumos]


def listar_stock_actual(
    db: Session,
    buscar: Optional[str] = None,
    stock_bajo: Optional[bool] = None,
    orden: str = "nombre_asc",
) -> list[schemas.StockInsumoQuimicoResponse]:
    consulta, filtros = _consulta_stock(buscar, stock_bajo)
    insumos = db.scalars(
        aplicar_orden(
            consulta.where(*filtros),
            InsumoQuimico,
            orden,
            _ORDENES_STOCK,
            "nombre_asc",
        )
    ).all()
    return _respuestas_stock(db, list(insumos))


def listar_stock_actual_paginado(
    db: Session,
    buscar: Optional[str],
    stock_bajo: Optional[bool],
    orden: str,
    page: int,
    page_size: int,
) -> tuple[list[schemas.StockInsumoQuimicoResponse], int]:
    consulta, filtros = _consulta_stock(buscar, stock_bajo)
    insumos, total = paginar_consulta(
        db,
        consulta,
        modelo=InsumoQuimico,
        filtros=filtros,
        orden=orden,
        ordenes=_ORDENES_STOCK,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )
    return _respuestas_stock(db, insumos), total


def actualizar_stock_minimo(
    db: Session, insumo_id: int, datos: schemas.StockMinimoUpdate
) -> schemas.StockInsumoQuimicoResponse:
    try:
        _obtener_insumo_activo(db, insumo_id)
        stock = _asegurar_stock(db, insumo_id)
        stock.stock_minimo = datos.stock_minimo
        db.commit()
        return _respuesta_stock(db, insumo_id)
    except Exception:
        db.rollback()
        raise


def registrar_ingreso(
    db: Session,
    insumo_id: int,
    datos: schemas.IngresoStockCreate,
    usuario: Personal,
) -> schemas.StockInsumoQuimicoResponse:
    try:
        insumo = _obtener_insumo_activo(db, insumo_id)
        _obtener_proveedor_activo(db, datos.proveedor_id)
        _aplicar_variacion(db, insumo_id, datos.cantidad)
        movimiento = _movimiento(
            insumo=insumo,
            variacion=datos.cantidad,
            tipo=TipoMovimientoStock.INGRESO,
            usuario_id=usuario.id,
            usuario_nombre=_nombre_persona(usuario),
        )
        db.add(movimiento)
        db.flush()
        db.add(
            LoteStock(
                proveedor_id=datos.proveedor_id,
                insumo_quimico_id=insumo.id,
                numero_lote=datos.numero_lote,
                cantidad_producto=datos.cantidad,
                movimiento_ingreso_id=movimiento.id,
            )
        )
        db.commit()
        return _respuesta_stock(db, insumo_id)
    except Exception:
        db.rollback()
        raise


def registrar_ajuste(
    db: Session,
    insumo_id: int,
    datos: schemas.AjusteStockCreate,
    usuario: Personal,
) -> schemas.StockInsumoQuimicoResponse:
    try:
        insumo = _obtener_insumo_activo(db, insumo_id)
        es_incremento = datos.operacion == "incremento"
        variacion = datos.cantidad if es_incremento else -datos.cantidad
        _aplicar_variacion(db, insumo_id, variacion)
        db.add(
            _movimiento(
                insumo=insumo,
                variacion=variacion,
                tipo=(
                    TipoMovimientoStock.AJUSTE_POSITIVO
                    if es_incremento
                    else TipoMovimientoStock.AJUSTE_NEGATIVO
                ),
                usuario_id=usuario.id,
                usuario_nombre=_nombre_persona(usuario),
                motivo=datos.motivo,
            )
        )
        db.commit()
        return _respuesta_stock(db, insumo_id)
    except Exception:
        db.rollback()
        raise


def listar_movimientos(
    db: Session,
    insumo_quimico_id: Optional[int],
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    tipo: Optional[TipoMovimientoStock],
    limit: int,
    offset: int,
) -> schemas.MovimientosStockResponse:
    consulta = select(MovimientoStockInsumoQuimico)
    conteo = select(func.count()).select_from(MovimientoStockInsumoQuimico)
    filtros = []
    if insumo_quimico_id is not None:
        filtros.append(MovimientoStockInsumoQuimico.insumo_quimico_id == insumo_quimico_id)
    if fecha_desde is not None:
        filtros.append(MovimientoStockInsumoQuimico.fecha >= datetime.combine(fecha_desde, time.min))
    if fecha_hasta is not None:
        limite_superior = datetime.combine(fecha_hasta + timedelta(days=1), time.min)
        filtros.append(MovimientoStockInsumoQuimico.fecha < limite_superior)
    if tipo is not None:
        filtros.append(MovimientoStockInsumoQuimico.tipo == tipo)
    if filtros:
        consulta = consulta.where(*filtros)
        conteo = conteo.where(*filtros)
    total = db.scalar(conteo) or 0
    movimientos = db.scalars(
        consulta.order_by(MovimientoStockInsumoQuimico.fecha.desc(), MovimientoStockInsumoQuimico.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return schemas.MovimientosStockResponse(
        items=[schemas.MovimientoStockResponse.model_validate(m) for m in movimientos],
        total=total,
        limit=limit,
        offset=offset,
    )


def listar_lotes(
    db: Session,
    proveedor_id: Optional[int],
    insumo_quimico_id: Optional[int],
    numero_lote: Optional[str],
    limit: int,
    offset: int,
) -> schemas.LotesStockResponse:
    consulta = (
        select(
            LoteStock,
            Proveedor.nombre.label("proveedor_nombre"),
            InsumoQuimico.nombre.label("nombre_producto"),
            UnidadMedida.simbolo.label("unidad_simbolo"),
        )
        .join(Proveedor, Proveedor.id == LoteStock.proveedor_id)
        .join(InsumoQuimico, InsumoQuimico.id == LoteStock.insumo_quimico_id)
        .join(UnidadMedida, UnidadMedida.id == InsumoQuimico.unidad_medida_id)
    )
    conteo = select(func.count()).select_from(LoteStock)
    filtros = []
    if proveedor_id is not None:
        filtros.append(LoteStock.proveedor_id == proveedor_id)
    if insumo_quimico_id is not None:
        filtros.append(LoteStock.insumo_quimico_id == insumo_quimico_id)
    if numero_lote:
        filtros.append(LoteStock.numero_lote.contains(numero_lote.strip()))
    if filtros:
        consulta = consulta.where(*filtros)
        conteo = conteo.where(*filtros)

    total = db.scalar(conteo) or 0
    filas = db.execute(
        consulta.order_by(LoteStock.fecha_ingreso.desc(), LoteStock.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return schemas.LotesStockResponse(
        items=[
            schemas.LoteStockResponse(
                id=fila.LoteStock.id,
                proveedor_id=fila.LoteStock.proveedor_id,
                proveedor_nombre=fila.proveedor_nombre,
                insumo_quimico_id=fila.LoteStock.insumo_quimico_id,
                nombre_producto=fila.nombre_producto,
                unidad_simbolo=fila.unidad_simbolo,
                numero_lote=fila.LoteStock.numero_lote,
                cantidad_producto=fila.LoteStock.cantidad_producto,
                fecha_ingreso=fila.LoteStock.fecha_ingreso,
                movimiento_ingreso_id=fila.LoteStock.movimiento_ingreso_id,
            )
            for fila in filas
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


def sincronizar_consumo_checklist(
    db: Session,
    *,
    registro_id: int,
    checklist_id: int,
    checklist_fecha: date,
    tarea_nombre: str,
    consumo_anterior: tuple[Optional[int], Optional[Decimal]],
    consumo_nuevo: tuple[Optional[int], Optional[Decimal]],
    usuario_id: int,
    usuario_nombre: str,
) -> None:
    """Registra solo la diferencia entre dos estados de consumo de una tarea."""
    anterior_id, anterior_cantidad = consumo_anterior
    nuevo_id, nueva_cantidad = consumo_nuevo
    anterior = anterior_cantidad or Decimal("0")
    nueva = nueva_cantidad or Decimal("0")
    if anterior_id == nuevo_id and anterior == nueva:
        return

    variaciones: list[tuple[int, Decimal, TipoMovimientoStock]] = []
    if anterior_id is not None and anterior > 0:
        if anterior_id == nuevo_id:
            diferencia = anterior - nueva
            if diferencia > 0:
                variaciones.append((anterior_id, diferencia, TipoMovimientoStock.REVERSO_CONSUMO))
            elif diferencia < 0:
                variaciones.append((anterior_id, diferencia, TipoMovimientoStock.CONSUMO_AUTOMATICO))
        else:
            variaciones.append((anterior_id, anterior, TipoMovimientoStock.REVERSO_CONSUMO))
    if nuevo_id is not None and nueva > 0 and anterior_id != nuevo_id:
        variaciones.append((nuevo_id, -nueva, TipoMovimientoStock.CONSUMO_AUTOMATICO))

    # Actualizar productos en un orden estable evita interbloqueos en motores
    # con bloqueo a nivel de fila; cualquier error revierte todo el PATCH.
    for insumo_id, variacion, _ in sorted(variaciones, key=lambda item: item[0]):
        _aplicar_variacion(db, insumo_id, variacion)

    for insumo_id, variacion, tipo in variaciones:
        # Un consumo previo puede pertenecer a un producto hoy inactivo: se lo
        # debe poder revertir para no dejar el saldo incorrecto.
        insumo = _obtener_insumo_activo(db, insumo_id, permitir_inactivo=True)
        db.add(
            _movimiento(
                insumo=insumo,
                variacion=variacion,
                tipo=tipo,
                usuario_id=usuario_id,
                usuario_nombre=usuario_nombre,
                motivo="Consumo informado en checklist.",
                checklist_id=checklist_id,
                registro_tarea_id=registro_id,
                checklist_fecha=checklist_fecha,
                tarea_nombre=tarea_nombre,
            )
        )
