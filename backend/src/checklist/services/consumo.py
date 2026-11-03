from datetime import date as date_
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.checklist import models, schemas
from src.checklist.exceptions import (
    FechaInvalida,
)
from src.insumoQuimico.models import InsumoQuimico
from src.unidadMedida.models import UnidadMedida


def listar_consumo_insumos(
    db: Session,
    fecha_desde: date_,
    fecha_hasta: date_,
) -> schemas.ConsumoInsumosResponse:
    """Consumo acumulado por producto químico en un rango de fechas.

    Solo cuenta los registros que efectivamente tienen consumo informado y
    cuya tarea fue completada, para no arrastrar consumos de tareas que
    después se desmarcaron.
    """
    if fecha_desde > fecha_hasta:
        raise FechaInvalida()

    filas = db.execute(
        select(
            models.RegistroTarea.insumo_quimico_id.label("insumo_quimico_id"),
            models.Checklist.fecha.label("fecha"),
            func.sum(models.RegistroTarea.cantidad_consumida).label("cantidad_total"),
            func.count(models.RegistroTarea.id).label("cantidad_registros"),
        )
        .join(
            models.Checklist,
            models.Checklist.id == models.RegistroTarea.checklist_id,
        )
        .where(
            models.Checklist.fecha >= fecha_desde,
            models.Checklist.fecha <= fecha_hasta,
            models.RegistroTarea.insumo_quimico_id.isnot(None),
            models.RegistroTarea.cantidad_consumida.isnot(None),
            models.RegistroTarea.cantidad_consumida > 0,
            models.RegistroTarea.completado.is_(True),
        )
        .group_by(models.RegistroTarea.insumo_quimico_id, models.Checklist.fecha)
    ).all()

    # Acumulamos por producto. Las fechas se mantienen por producto, porque
    # sumar en una misma fecha litros, kilos u otras unidades es inválido.
    por_insumo: Dict[int, Dict[str, object]] = {}
    por_producto_fecha: Dict[tuple[int, date_], float] = {}

    for insumo_id, fecha, cantidad_total, cantidad_registros in filas:
        cantidad_total = float(cantidad_total or 0)
        cantidad_registros = int(cantidad_registros or 0)

        insumo = por_insumo.setdefault(
            insumo_id,
            {
                "nombre": None,
                "unidad_simbolo": None,
                "cantidad_total": 0.0,
                "cantidad_registros": 0,
            },
        )

        insumo["cantidad_total"] = float(insumo["cantidad_total"]) + cantidad_total
        insumo["cantidad_registros"] = int(insumo["cantidad_registros"]) + cantidad_registros

        por_producto_fecha[(insumo_id, fecha)] = cantidad_total

    # Completamos nombre y unidad de cada producto con una sola consulta.
    ids = list(por_insumo.keys())
    nombres: Dict[int, tuple] = {}

    if ids:
        nombres = {
            id_: (nombre, unidad_id, simbolo)
            for id_, nombre, unidad_id, simbolo in db.execute(
                select(
                    InsumoQuimico.id,
                    InsumoQuimico.nombre,
                    InsumoQuimico.unidad_medida_id,
                    UnidadMedida.simbolo,
                )
                .join(UnidadMedida, InsumoQuimico.unidad_medida_id == UnidadMedida.id)
                .where(InsumoQuimico.id.in_(ids))
            ).all()
        }

    items: List[schemas.ConsumoInsumoItem] = []

    for insumo_id, datos in por_insumo.items():
        nombre, _, simbolo = nombres.get(insumo_id, (None, None, None))
        items.append(
            schemas.ConsumoInsumoItem(
                insumo_quimico_id=insumo_id,
                nombre=nombre or f"Insumo {insumo_id}",
                unidad_simbolo=simbolo,
                cantidad_total=round(float(datos["cantidad_total"]), 2),
                cantidad_registros=int(datos["cantidad_registros"]),
            )
        )

    items.sort(key=lambda i: i.cantidad_total, reverse=True)

    totales_por_unidad: Dict[tuple[int, Optional[str]], float] = {}
    detalle_por_fecha = []
    for (insumo_id, fecha), cantidad_total in sorted(por_producto_fecha.items(), key=lambda item: item[0][1]):
        nombre, unidad_id, simbolo = nombres.get(insumo_id, (f"Insumo {insumo_id}", 0, None))
        clave_unidad = (unidad_id, simbolo)
        totales_por_unidad[clave_unidad] = totales_por_unidad.get(clave_unidad, 0.0) + cantidad_total
        detalle_por_fecha.append(
            schemas.ConsumoPorFechaItem(
                fecha=fecha,
                insumo_quimico_id=insumo_id,
                nombre=nombre,
                unidad_medida_id=unidad_id,
                unidad_simbolo=simbolo,
                cantidad_total=round(cantidad_total, 2),
            )
        )

    return schemas.ConsumoInsumosResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumos=items,
        totales_por_unidad=[
            schemas.ConsumoPorUnidadItem(
                unidad_medida_id=unidad_id,
                unidad_simbolo=simbolo,
                cantidad_total=round(total, 2),
            )
            for (unidad_id, simbolo), total in sorted(totales_por_unidad.items())
        ],
        por_producto_fecha=detalle_por_fecha,
    )
