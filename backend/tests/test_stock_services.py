from decimal import Decimal

import pytest

from src.insumoQuimico import exceptions, schemas
from src.insumoQuimico import stock_services
from src.insumoQuimico.models import InsumoQuimico, LoteStock, StockInsumoQuimico, TipoQuimico
from src.insumoQuimico.stock_services import (
    listar_movimientos,
    listar_stock_actual,
    registrar_ajuste,
    registrar_ingreso,
    sincronizar_consumo_checklist,
)
from src.insumoQuimico.services import crear_insumo_quimico
from src.personal.models import Personal
from src.proveedores.models import Proveedor
from src.unidadMedida.models import UnidadMedida


def _producto_y_admin(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    admin = Personal(
        nombre="Ana",
        apellido="Admin",
        dni="12345678",
        telefono=None,
        email="ana@example.com",
        password="hash",
        puede_operar=True,
        puede_administrar=True,
    )
    proveedor = Proveedor(nombre="Proveedor de prueba", matricula="MAT-001")
    db.add_all([unidad, admin, proveedor])
    db.flush()
    producto = InsumoQuimico(
        nombre="Desinfectante", tipo=TipoQuimico.DESINFECTANTE, unidad_medida_id=unidad.id
    )
    db.add(producto)
    db.flush()
    db.add(StockInsumoQuimico(insumo_quimico_id=producto.id))
    db.commit()
    return producto, admin, proveedor


def test_ingreso_y_ajuste_dejan_historial_y_saldo(db):
    producto, admin, proveedor = _producto_y_admin(db)

    registrar_ingreso(
        db,
        producto.id,
        schemas.IngresoStockCreate(cantidad="5", proveedor_id=proveedor.id, numero_lote="000123"),
        admin,
    )
    registrar_ajuste(
        db,
        producto.id,
        schemas.AjusteStockCreate(cantidad="2", operacion="decremento", motivo="Conteo físico"),
        admin,
    )

    stock = listar_stock_actual(db)
    movimientos = listar_movimientos(db, producto.id, None, None, None, 25, 0)
    assert stock[0].cantidad_actual == Decimal("3.000")
    assert movimientos.total == 2
    assert movimientos.items[0].responsable_nombre == "Ana Admin"
    lote = db.query(LoteStock).one()
    assert lote.proveedor_id == proveedor.id
    assert lote.numero_lote == "000123"
    assert lote.movimiento_ingreso_id is not None


def test_ingresos_repetidos_del_mismo_lote_conservan_registros_independientes(db):
    producto, admin, proveedor = _producto_y_admin(db)

    for cantidad in ("2", "3"):
        registrar_ingreso(
            db,
            producto.id,
            schemas.IngresoStockCreate(
                cantidad=cantidad,
                proveedor_id=proveedor.id,
                numero_lote="LOTE-001",
            ),
            admin,
        )

    lotes = db.query(LoteStock).order_by(LoteStock.id).all()
    assert len(lotes) == 2
    assert len({lote.movimiento_ingreso_id for lote in lotes}) == 2
    assert [lote.cantidad_producto for lote in lotes] == [Decimal("2.000"), Decimal("3.000")]


def test_producto_nuevo_nace_con_stock_cero(db):
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg")
    db.add(unidad)
    db.commit()

    producto = crear_insumo_quimico(
        db,
        schemas.InsumoQuimicoCreate(
            nombre="Detergente nuevo",
            tipo=TipoQuimico.DETERGENTE,
            unidad_medida_id=unidad.id,
        ),
    )

    saldo = db.get(StockInsumoQuimico, producto.id)
    assert saldo is not None
    assert saldo.cantidad_actual == Decimal("0.000")


def test_ajuste_no_permite_stock_negativo_ni_movimiento_parcial(db):
    producto, admin, proveedor = _producto_y_admin(db)
    registrar_ingreso(
        db,
        producto.id,
        schemas.IngresoStockCreate(cantidad="1", proveedor_id=proveedor.id, numero_lote="000123"),
        admin,
    )

    with pytest.raises(exceptions.StockInsuficiente):
        registrar_ajuste(
            db,
            producto.id,
            schemas.AjusteStockCreate(cantidad="2", operacion="decremento", motivo="Conteo físico"),
            admin,
        )

    stock = listar_stock_actual(db)
    movimientos = listar_movimientos(db, producto.id, None, None, None, 25, 0)
    assert stock[0].cantidad_actual == Decimal("1.000")
    assert movimientos.total == 1


def test_sincronizacion_de_consumo_aplica_solo_la_diferencia(db):
    producto, admin, proveedor = _producto_y_admin(db)
    registrar_ingreso(
        db,
        producto.id,
        schemas.IngresoStockCreate(cantidad="10", proveedor_id=proveedor.id, numero_lote="000123"),
        admin,
    )

    sincronizar_consumo_checklist(
        db,
        registro_id=None,
        checklist_id=None,
        checklist_fecha=None,
        tarea_nombre="Limpieza",
        consumo_anterior=(producto.id, Decimal("2")),
        consumo_nuevo=(producto.id, Decimal("5")),
        usuario_id=admin.id,
        usuario_nombre="Ana Admin",
    )
    db.commit()
    assert listar_stock_actual(db)[0].cantidad_actual == Decimal("7.000")

    sincronizar_consumo_checklist(
        db,
        registro_id=None,
        checklist_id=None,
        checklist_fecha=None,
        tarea_nombre="Limpieza",
        consumo_anterior=(producto.id, Decimal("5")),
        consumo_nuevo=(producto.id, Decimal("5")),
        usuario_id=admin.id,
        usuario_nombre="Ana Admin",
    )
    db.commit()
    assert listar_movimientos(db, producto.id, None, None, None, 25, 0).total == 2


def test_stock_actual_omite_inactivos_pero_conserva_su_historial(db):
    producto, admin, proveedor = _producto_y_admin(db)
    registrar_ingreso(
        db,
        producto.id,
        schemas.IngresoStockCreate(cantidad="1", proveedor_id=proveedor.id, numero_lote="000123"),
        admin,
    )
    producto.activo = False
    db.commit()

    assert listar_stock_actual(db) == []
    assert listar_movimientos(db, producto.id, None, None, None, 25, 0).total == 1


def test_fallo_al_crear_lote_revierte_saldo_y_movimiento(db, monkeypatch):
    producto, admin, proveedor = _producto_y_admin(db)

    def fallar_lote(**_kwargs):
        raise RuntimeError("fallo de persistencia del lote")

    monkeypatch.setattr(stock_services, "LoteStock", fallar_lote)
    with pytest.raises(RuntimeError):
        registrar_ingreso(
            db,
            producto.id,
            schemas.IngresoStockCreate(cantidad="2", proveedor_id=proveedor.id, numero_lote="000123"),
            admin,
        )

    assert db.get(StockInsumoQuimico, producto.id).cantidad_actual == Decimal("0.000")
    assert listar_movimientos(db, producto.id, None, None, None, 25, 0).total == 0
