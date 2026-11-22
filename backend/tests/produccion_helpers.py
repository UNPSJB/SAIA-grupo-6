"""Ayudas para los tests de producción.

Una tarea del checklist solo se completa cuando el consumo real de cada
ingrediente llega a lo que pide la receta. Los tests que no prueban los
consumos usan estas funciones para registrar justo lo planificado.
"""

from sqlalchemy import select

from src.lotes import services
from src.lotes.constants import TIPO_CONSUMO_REAL
from src.lotes.models import ConsumoInsumo
from src.lotesInsumo.models import LoteInsumo


def registrar_lo_planificado(db, lote_id, item_id, usuario):
    """Registra el consumo real que le falta a la tarea, del primer lote de cada ingrediente."""
    lote = services.obtener_lote(db, lote_id)
    item = next(i for i in lote.checklist if i.id == item_id)
    for planificado in services._planificados_del_item(db, lote, item):
        falta = planificado.cantidad_planificada - planificado.consumo_real
        if falta <= 0:
            continue
        lote_insumo = db.scalar(
            select(LoteInsumo)
            .where(LoteInsumo.ingrediente_id == planificado.ingrediente_id, LoteInsumo.activo.is_(True))
            .order_by(LoteInsumo.id)
        )
        assert lote_insumo is not None, f"No hay lotes de {planificado.ingrediente_nombre} para consumir"
        db.add(
            ConsumoInsumo(
                checklist_produccion_id=item.id,
                lote_insumo_id=lote_insumo.id,
                cantidad=falta,
                tipo=TIPO_CONSUMO_REAL,
                registrado_por_id=usuario.id,
            )
        )
    db.commit()
    db.expire_all()


def completar_tarea(db, lote_id, item_id, usuario):
    """Registra lo planificado que falte y completa la tarea."""
    registrar_lo_planificado(db, lote_id, item_id, usuario)
    return services.completar_item(db, lote_id, item_id, usuario)


def rotular_lote(db, lote):
    """Borrador de rotulado completo vinculado al lote (sin él, el lote no se vende)."""
    from datetime import date, timedelta

    from src.rotulado.models import BorradorRotulado

    cierre = (lote.fecha_cierre or lote.fecha_inicio).date()
    db.info["sin_auditoria"] = True
    try:
        db.add(
            BorradorRotulado(
                producto_id=lote.producto_id,
                version_receta_id=lote.version_receta_id,
                lote_producto_id=lote.id,
                denominacion_venta="Producto de prueba",
                lista_ingredientes="Ingredientes de prueba",
                contenido_neto="500 g",
                rnpa_rppa="RNPA 07-123456",
                razon_social="Alimentos de Prueba S.A.",
                domicilio="Calle Falsa 123",
                identificacion_lote=lote.numero_lote,
                fecha_produccion=lote.fecha_inicio.date() if lote.fecha_inicio else date.today(),
                fecha_cierre=cierre,
                fecha_duracion=lote.fecha_vencimiento or cierre + timedelta(days=180),
                instrucciones_uso="Conservar en lugar fresco y seco.",
            )
        )
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

