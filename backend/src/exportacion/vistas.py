"""Exportación de vistas calculadas (no son una tabla cruda de la base).

El exportador genérico (`motor.py`) vuelca una tabla tal cual está en la base.
Estas vistas se arman en el servidor combinando varias fuentes o calculando
campos (estado de un vencimiento, stock bajo...), así que acá se reproducen las
mismas filas y filtros que muestra cada tabla del frontend.

Cada función devuelve `(titulo, encabezados, filas)` con las filas ya en texto.
"""

from __future__ import annotations

import unicodedata
from datetime import date
from typing import Callable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.checklist import services as checklist_services
from src.clientes import services as clientes_services
from src.exportacion.formato import texto
from src.insumoQuimico import stock_services
from src.lotes import services as lotes_services
from src.nutricion import services as nutricion_services
from src.productos import services as productos_services
from src.recetas import services as recetas_services
from src.retiros import services as retiros_services
from src.rotulado import services as rotulado_services
from src.salidas import services as salidas_services
from src.transportistas import services as transportistas_services
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


# ---------------------------------------------------------------------------
# Producción: lotes, salidas, retiros, recetas, productos, alimentos y
# rotulado. Cada vista reusa el servicio del listado y aplica los mismos
# filtros que la pantalla, incluida la búsqueda de texto (que en el frontend
# se hace en el navegador).
# ---------------------------------------------------------------------------

_ETIQUETA_ESTADO_LOTE = {
    "en_proceso": "En proceso",
    "terminado": "Terminado",
    "cancelado": "Cancelado",
}

_ETIQUETA_ESTADO_SALIDA = {
    "RESERVADO": "Reservado",
    "DESPACHADO": "Despachado",
    "ENTREGADO": "Entregado",
    "CANCELADO": "Cancelado",
    "RECHAZADA": "Rechazada",
}

_ETIQUETA_DISPOSICION = {
    "REINGRESADA": "Reingresada",
    "DESECHADA": "Desechada",
}

_ETIQUETA_ESTADO_RETIRO = {"EN_CURSO": "En curso", "CERRADO": "Cerrado"}


def _numero(valor) -> str:
    """Cantidad en formato es-AR, hasta 3 decimales y sin ceros de sobra."""
    if valor is None or valor == "":
        return "-"
    numero = float(valor)
    entero = f"{numero:,.3f}".rstrip("0").rstrip(".")
    return entero.replace(",", "X").replace(".", ",").replace("X", ".")


def _cantidad(valor, simbolo: Optional[str]) -> str:
    numero = _numero(valor)
    return f"{numero} {simbolo}" if simbolo and numero != "-" else numero


def _normalizar(valor: Optional[str]) -> str:
    """Minúsculas y sin tildes, como la búsqueda de Recetas en el frontend."""
    if not valor:
        return ""
    descompuesto = unicodedata.normalize("NFD", valor)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn").lower().strip()


def _coincide(buscar: Optional[str], *campos: Optional[str]) -> bool:
    texto_buscado = _normalizar(buscar)
    if not texto_buscado:
        return True
    return any(texto_buscado in _normalizar(campo) for campo in campos)


def lotes_produccion(
    db: Session,
    producto_id: Optional[int],
    estado: Optional[str],
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    buscar: Optional[str],
) -> Vista:
    lotes = [
        lotes_services.resumen(lote)
        for lote in lotes_services.listar_lotes(db, producto_id, estado, fecha_desde, fecha_hasta)
    ]
    filas = [
        [
            texto(l.fecha_inicio.date() if hasattr(l.fecha_inicio, "date") else l.fecha_inicio),
            texto(l.numero_lote),
            texto(l.producto_nombre),
            f"v{l.version_numero}" if l.version_numero else "Sin receta",
            _cantidad(l.cantidad_objetivo, l.unidad),
            f"{l.items_completados} de {l.items_total}",
            _ETIQUETA_ESTADO_LOTE.get(l.estado, l.estado),
            texto(l.fecha_vencimiento) if l.fecha_vencimiento else "-",
        ]
        for l in lotes
        if _coincide(buscar, l.numero_lote, l.producto_nombre)
    ]
    return (
        "Lotes de producción",
        ["Fecha", "Número de lote", "Producto", "Receta", "Objetivo", "Tareas", "Estado", "Vencimiento"],
        filas,
    )


def salidas_producto(db: Session, estado: Optional[str], buscar: Optional[str]) -> Vista:
    salidas = [
        salidas_services.salida_a_resumen(s, db)
        for s in salidas_services.listar_salidas(db, estado=estado, lote_id=None, cliente_id=None)
    ]
    filas = []
    for s in salidas:
        if estado and s.estado != estado:
            continue
        if not _coincide(buscar, s.lote_numero, s.producto_nombre, s.cliente_nombre):
            continue
        etiqueta = _ETIQUETA_ESTADO_SALIDA.get(s.estado, s.estado)
        if s.estado == "RECHAZADA":
            disposicion = getattr(s, "disposicion", None)
            etiqueta += f" ({_ETIQUETA_DISPOSICION.get(disposicion, 'En revisión')})"
        filas.append(
            [
                texto(s.producto_nombre),
                texto(s.lote_numero),
                texto(s.cliente_nombre),
                _cantidad(s.cantidad, s.unidad_medida),
                texto(s.fecha_reserva),
                etiqueta,
            ]
        )
    return (
        "Salidas de producto",
        ["Producto", "Lote", "Cliente", "Cantidad", "Fecha de reserva", "Estado"],
        filas,
    )


def retiros_lotes(db: Session, estado: Optional[str], buscar: Optional[str]) -> Vista:
    retiros = [
        retiros_services.retiro_a_resumen(r)
        for r in retiros_services.listar_retiros(db, lote_id=None, estado=estado, incidente_id=None)
    ]
    filas = [
        [
            texto(r.fecha_retiro),
            texto(r.lote_producto_nombre),
            texto(r.lote_codigo),
            texto(r.motivo),
            "Sin afectados" if r.total_afectados == 0 else f"{r.notificados} de {r.total_afectados}",
            _ETIQUETA_ESTADO_RETIRO.get(r.estado, r.estado),
        ]
        for r in retiros
        if (not estado or r.estado == estado)
        and _coincide(buscar, r.lote_codigo, r.lote_producto_nombre, r.motivo)
    ]
    return (
        "Retiros de lotes",
        ["Fecha", "Producto", "Lote", "Motivo", "Notificados", "Estado"],
        filas,
    )


def recetas(db: Session, buscar: Optional[str]) -> Vista:
    filas = []
    for receta in recetas_services.listar_recetas(db):
        r = recetas_services.a_respuesta(db, receta)
        if not _coincide(buscar, r.producto_nombre):
            continue
        v = r.version_vigente
        filas.append(
            [
                texto(r.producto_nombre),
                f"v{v.numero}" if v else "-",
                _cantidad(v.rendimiento, v.unidad_medida.simbolo) if v else "-",
                texto(v.creado_en.date()) if v else "-",
            ]
        )
    return ("Recetas", ["Producto", "Versión vigente", "Rendimiento", "Vigente desde"], filas)


def productos(db: Session, incluir_inactivos: bool, buscar: Optional[str]) -> Vista:
    filas = [
        [
            texto(p.nombre),
            p.descripcion or "-",
            texto(p.unidad_medida.simbolo if p.unidad_medida else None),
            "Activo" if p.activo else "Dado de baja",
        ]
        for p in productos_services.listar_productos(db, incluir_inactivos, buscar)
        if not incluir_inactivos or not p.activo
    ]
    return (
        "Productos dados de baja" if incluir_inactivos else "Productos",
        ["Nombre", "Descripción", "Unidad", "Estado"],
        filas,
    )


def clientes(db: Session, solo_inactivos: bool, buscar: Optional[str], orden: str) -> Vista:
    filas = [
        [
            texto(c.nombre),
            texto(c.documento),
            texto(c.telefono),
            texto(c.email),
            texto(c.domicilio),
        ]
        for c in clientes_services.listar_clientes(
            db, solo_inactivos=solo_inactivos, buscar=buscar, orden=orden
        )
    ]
    return (
        "Clientes dados de baja" if solo_inactivos else "Clientes",
        ["Nombre", "Documento", "Teléfono", "E-mail", "Domicilio"],
        filas,
    )


def transportistas(db: Session, solo_inactivos: bool, buscar: Optional[str], orden: str) -> Vista:
    filas = [
        [
            texto(t.razon_social),
            texto(t.cuit),
            texto(t.telefono),
            texto(t.email),
            texto(t.domicilio),
            t.estado_habilitacion,
            texto(t.observaciones),
        ]
        for t in transportistas_services.listar_transportistas(
            db, solo_inactivos=solo_inactivos, buscar=buscar, orden=orden
        )
    ]
    return (
        "Transportistas dados de baja" if solo_inactivos else "Transportistas",
        ["Razón social", "CUIT", "Teléfono", "E-mail", "Domicilio", "Habilitación", "Observaciones"],
        filas,
    )


_COLUMNAS_ALIMENTO = [
    ("energia", "Energía (kcal)"),
    ("carbohidratos", "Carbohidratos (g)"),
    ("azucares_totales", "Azúcares (g)"),
    ("proteinas", "Proteínas (g)"),
    ("grasas_totales", "Grasas totales (g)"),
    ("grasas_saturadas", "Grasas saturadas (g)"),
    ("fibra", "Fibra (g)"),
    ("sodio", "Sodio (mg)"),
]


def alimentos_referencia(db: Session, buscar: Optional[str], base: Optional[str]) -> Vista:
    # Mismo tope que la tabla de la pantalla (el máximo de la API).
    alimentos = nutricion_services.listar_alimentos(db, buscar, base, 500)
    filas = [
        [texto(a.nombre), texto(a.base)]
        + [_numero(getattr(a, clave)) for clave, _ in _COLUMNAS_ALIMENTO]
        for a in alimentos
    ]
    return (
        "Base de composición de alimentos (valores por 100 g)",
        ["Alimento", "Base"] + [etiqueta for _, etiqueta in _COLUMNAS_ALIMENTO],
        filas,
    )


def rotulado_productos(db: Session, buscar: Optional[str]) -> Vista:
    filas = []
    for p in productos_services.listar_productos(db, False, buscar):
        # El actualizado más recientemente viene primero.
        borradores = rotulado_services.obtener_borradores_por_producto(db, p.id)
        filas.append([
            texto(p.nombre),
            texto(p.unidad_medida.simbolo if p.unidad_medida else None),
            str(len(borradores)),
            texto(borradores[0].actualizado_en) if borradores else "-",
        ])
    return (
        "Rotulado de productos",
        ["Producto", "Unidad", "Borradores", "Último borrador actualizado"],
        filas,
    )
