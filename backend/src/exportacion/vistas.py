"""Exportación de vistas calculadas (no son una tabla cruda de la base).

El exportador genérico (`motor.py`) vuelca una tabla tal cual está en la base.
Estas vistas se arman en el servidor combinando varias fuentes o calculando
campos (estado de un vencimiento, stock bajo...), así que acá se reproducen las
mismas filas y filtros que muestra cada tabla del frontend.

Cada función devuelve `(titulo, encabezados, filas)` con las filas ya en texto.
"""

from __future__ import annotations

from datetime import date
from typing import Callable, Optional

from sqlalchemy.orm import Session

from src.checklist import services as checklist_services
from src.exportacion.formato import texto
from src.insumoQuimico import stock_services
from src.vencimientos import services as vencimientos_services

Vista = tuple[str, list[str], list[list[str]]]

LOTE = 100

_ETIQUETA_ESTADO_VENCIMIENTO = {
    "VENCIDO": "Vencido",
    "PROXIMO": "Próximo a vencer",
    "VIGENTE": "Vigente",
}

ETIQUETA_TIPO_MOVIMIENTO = {
    "ingreso": "Ingreso",
    "ajuste_positivo": "Ajuste (+)",
    "ajuste_negativo": "Ajuste (-)",
    "consumo_automatico": "Consumo automático",
    "reverso_consumo": "Reverso de consumo",
}


def _con_unidad(cantidad, simbolo: Optional[str]) -> str:
    return f"{cantidad} {simbolo}" if simbolo else str(cantidad)


def _texto_dias(dias: int) -> str:
    if dias < 0:
        return f"Venció hace {-dias} día(s)"
    if dias == 0:
        return "Vence hoy"
    return f"Vence en {dias} día(s)"


def _paginar(listar: Callable[[int, int], tuple[list, int]]) -> list:
    """Junta todas las filas de un listado con limit/offset."""
    items: list = []
    offset = 0
    while True:
        pagina, total = listar(LOTE, offset)
        items.extend(pagina)
        offset += LOTE
        if offset >= total or not pagina:
            return items


def vencimientos(
    db: Session,
    tipo: Optional[str],
    persona_id: Optional[int],
    aptitud: Optional[str],
    estado: Optional[str],
    buscar: Optional[str],
    orden: Optional[str],
) -> Vista:
    items, _ = vencimientos_services.listar_vencimientos_paginado(
        db, tipo, persona_id, aptitud, estado, buscar, orden, 1, 10**9
    )
    etiquetas_tipo = vencimientos_services._ETIQUETA_TIPO
    filas = [
        [
            etiquetas_tipo.get(v.tipo, v.tipo),
            texto(v.detalle),
            texto(v.sujeto),
            texto(v.fecha_vencimiento),
            _texto_dias(v.dias_restantes),
            _ETIQUETA_ESTADO_VENCIMIENTO.get(v.estado, v.estado),
        ]
        for v in items
    ]
    return (
        "Vencimientos",
        ["Tipo", "Detalle", "Persona / Equipo", "Vencimiento", "Plazo", "Estado"],
        filas,
    )


def stock_actual(
    db: Session,
    buscar: Optional[str],
    stock_bajo: Optional[bool],
    orden: str,
) -> Vista:
    items = stock_services.listar_stock_actual(db, buscar, stock_bajo, orden)
    filas = [
        [
            texto(i.nombre),
            _con_unidad(i.cantidad_actual, i.unidad_simbolo),
            _con_unidad(i.stock_minimo, i.unidad_simbolo)
            if i.stock_minimo is not None
            else "Sin definir",
            "Stock bajo" if i.stock_bajo else "Disponible",
        ]
        for i in items
    ]
    return (
        "Stock actual",
        ["Producto", "Stock actual", "Stock mínimo", "Estado"],
        filas,
    )


def stock_movimientos(
    db: Session,
    insumo_quimico_id: Optional[int],
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    tipo,
) -> Vista:
    def listar(limit: int, offset: int):
        r = stock_services.listar_movimientos(
            db, insumo_quimico_id, fecha_desde, fecha_hasta, tipo, limit, offset
        )
        return r.items, r.total

    filas = []
    for m in _paginar(listar):
        variacion = float(m.cantidad_variacion)
        signo = "+" if variacion > 0 else ""
        detalle = m.tarea_nombre or (
            f"Checklist #{m.checklist_id}" if m.checklist_id is not None else m.motivo
        )
        filas.append(
            [
                texto(m.fecha),
                _con_unidad(m.nombre_producto, f"({m.unidad_simbolo})" if m.unidad_simbolo else None),
                ETIQUETA_TIPO_MOVIMIENTO.get(str(getattr(m.tipo, "value", m.tipo)), str(m.tipo)),
                f"{signo}{m.cantidad_variacion}",
                m.responsable_nombre or "Sistema",
                texto(detalle),
            ]
        )
    return (
        "Movimientos de stock",
        ["Fecha", "Producto", "Tipo", "Variación", "Responsable", "Detalle"],
        filas,
    )


def stock_lotes(
    db: Session,
    proveedor_id: Optional[int],
    insumo_quimico_id: Optional[int],
    numero_lote: Optional[str],
) -> Vista:
    def listar(limit: int, offset: int):
        r = stock_services.listar_lotes(
            db, proveedor_id, insumo_quimico_id, numero_lote, limit, offset
        )
        return r.items, r.total

    filas = [
        [
            texto(lote.proveedor_nombre),
            texto(lote.numero_lote),
            texto(lote.nombre_producto),
            _con_unidad(lote.cantidad_producto, lote.unidad_simbolo),
            texto(lote.fecha_ingreso),
        ]
        for lote in _paginar(listar)
    ]
    return (
        "Lotes de stock",
        ["Proveedor", "Lote", "Producto", "Cantidad producto", "Fecha ingreso"],
        filas,
    )


def stock_consumo(db: Session, fecha_desde: date, fecha_hasta: date) -> Vista:
    consumo = checklist_services.listar_consumo_insumos(db, fecha_desde, fecha_hasta)
    filas = [
        [
            texto(i.nombre),
            _con_unidad(i.cantidad_total, i.unidad_simbolo),
            str(i.cantidad_registros),
        ]
        for i in consumo.insumos
    ]
    return (
        f"Consumo de insumos ({texto(consumo.fecha_desde)} al {texto(consumo.fecha_hasta)})",
        ["Producto", "Cantidad acumulada", "Registros"],
        filas,
    )
