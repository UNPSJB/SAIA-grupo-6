from decimal import Decimal

from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico, TipoQuimico
from src.notificaciones.services import obtener_todas_notificaciones
from src.unidadMedida.models import UnidadMedida


def test_notificaciones_stock_bajo_solo_incluyen_insumos_activos_bajo_el_minimo(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    db.add(unidad)
    db.flush()

    bajo_minimo = InsumoQuimico(
        nombre="Desinfectante",
        tipo=TipoQuimico.DESINFECTANTE,
        unidad_medida_id=unidad.id,
    )
    en_minimo = InsumoQuimico(
        nombre="Detergente",
        tipo=TipoQuimico.DETERGENTE,
        unidad_medida_id=unidad.id,
    )
    inactivo = InsumoQuimico(
        nombre="Sanitizante",
        tipo=TipoQuimico.SANITIZANTE,
        unidad_medida_id=unidad.id,
        activo=False,
    )
    db.add_all([bajo_minimo, en_minimo, inactivo])
    db.flush()
    db.add_all(
        [
            StockInsumoQuimico(
                insumo_quimico_id=bajo_minimo.id,
                cantidad_actual=Decimal("1"),
                stock_minimo=Decimal("2"),
            ),
            StockInsumoQuimico(
                insumo_quimico_id=en_minimo.id,
                cantidad_actual=Decimal("2"),
                stock_minimo=Decimal("2"),
            ),
            StockInsumoQuimico(
                insumo_quimico_id=inactivo.id,
                cantidad_actual=Decimal("1"),
                stock_minimo=Decimal("2"),
            ),
        ]
    )
    db.commit()

    notificaciones = obtener_todas_notificaciones(db)

    assert len(notificaciones) == 1
    assert notificaciones[0].model_dump() == {
        "id_notificacion": f"stock-bajo-{bajo_minimo.id}",
        "tipo": "STOCK_BAJO",
        "entidad_id": bajo_minimo.id,
        "titulo": "Stock bajo",
        "mensaje": (
            "El insumo 'Desinfectante' tiene 1.000 L disponibles; "
            "el mínimo configurado es 2.000 L."
        ),
        "nivel": "STOCK_BAJO",
        "link_destino": "/gestion-stock/stock",
        "fecha_referencia": None,
    }
