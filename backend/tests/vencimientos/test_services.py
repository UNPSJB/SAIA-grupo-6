"""Tests unitarios de services del módulo `vencimientos` (consulta consolidada)."""

from datetime import date
from decimal import Decimal

from src.aptitud.models import Aptitud
from src.notificaciones.services import obtener_dias_alerta_vencimiento_personal
from src.personal.models import Personal
from src.vencimientos import schemas
from src.vencimientos.services import (
    listar_opciones_vencimientos,
    listar_vencimientos,
    listar_vencimientos_paginado,
)
from tests.database import db_session


def _personal(db, dni="12345678", email="j@test.com", activo=True):
    fila = Personal(
        nombre="Juan", apellido="Perez", dni=dni, email=email,
        password="h", puede_operar=True, puede_administrar=False, activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _aptitud(db, nombre="Altura", activo=True):
    fila = Aptitud(nombre=nombre, descripcion="d", activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _vencimiento_personal(db, persona_id, aptitud_id, fecha, activo=True):
    from src.vencimientoPersonal.models import VencimientoPersonal
    fila = VencimientoPersonal(
        persona_id=persona_id, aptitud_id=aptitud_id,
        fecha_vencimiento=fecha, activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _mock_hoy_y_margen(monkeypatch, fecha_hoy, margen_dias=15):
    monkeypatch.setattr("src.common.fechas.hoy", lambda: fecha_hoy)
    monkeypatch.setattr(
        "src.vencimientos.services.hoy", lambda: fecha_hoy,
    )
    monkeypatch.setattr(
        "src.vencimientos.services.obtener_dias_alerta_vencimiento_personal",
        lambda db: margen_dias,
    )


# ---------------------------------------------------------------------------
# listar_vencimientos
# ---------------------------------------------------------------------------

def test_listar_vencimientos_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = listar_vencimientos(db_session)

    # Assert
    assert resultado == []


def test_listar_vencimientos_con_personal(db_session, monkeypatch):
    # Arrange
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10), margen_dias=15)
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    # Vence en 2025-06-20: 10 días restantes -> PROXIMO (dentro del margen de 15)
    _vencimiento_personal(db_session, persona.id, aptitud.id, date(2025, 6, 20))

    # Act
    resultado = listar_vencimientos(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "PERSONAL"
    assert resultado[0].sujeto == "Juan Perez"
    assert resultado[0].dias_restantes == 10


def test_listar_vencimientos_filtro_por_tipo(db_session, monkeypatch):
    # Arrange
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = listar_vencimientos(db_session, tipo="CALIBRACION")

    # Assert
    assert resultado == []


# ---------------------------------------------------------------------------
# listar_vencimientos_paginado
# ---------------------------------------------------------------------------

def test_listar_vencimientos_paginado_page_y_page_size(db_session, monkeypatch):
    # Arrange
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session)
    for i in range(5):
        aptitud = _aptitud(db_session, nombre=f"Aptitud {i}")
        _vencimiento_personal(
            db_session, persona.id, aptitud.id,
            date(2025, 6, 20 + i),
        )

    # Act
    items, total = listar_vencimientos_paginado(
        db_session, tipo=None, persona_id=None, aptitud=None, estado=None,
        buscar=None, orden=None, page=1, page_size=2,
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# listar_opciones_vencimientos
# ---------------------------------------------------------------------------

def test_listar_opciones_vencimientos(db_session, monkeypatch):
    # Arrange
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    _vencimiento_personal(db_session, persona.id, aptitud.id, date(2025, 6, 20))

    # Act
    opciones = listar_opciones_vencimientos(db_session)

    # Assert
    assert len(opciones.personas) == 1
    assert opciones.personas[0].nombre == "Juan Perez"
    assert aptitud.nombre in opciones.aptitudes


# ---------------------------------------------------------------------------
# Lotes de producción en el consolidado de vencimientos
# ---------------------------------------------------------------------------

def _lote_terminado_con_vencimiento(db, numero="LP-001", vence=None, saldo_positivo=True):
    from src.lotes.models import LoteProducto
    from src.productos.models import Producto
    from src.unidadMedida.models import UnidadMedida
    from src.salidas.models import Salida
    from src.salidas.constants import ESTADO_ENTREGADO
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa")
    producto = Producto(nombre=f"Producto {numero}", unidad_medida=unidad)
    db.add_all([unidad, producto])
    db.commit()
    db.refresh(producto)

    lote = LoteProducto(
        numero_lote=numero,
        producto=producto,
        estado="terminado",
        cantidad_objetivo=Decimal("100"),
        cantidad_producida=Decimal("100"),
        fecha_vencimiento=vence,
    )
    db.add(lote)
    db.commit()
    db.refresh(lote)

    # Si no debe tener saldo, agregar una salida que consuma todo.
    if not saldo_positivo:
        from src.clientes.models import Cliente
        cliente = Cliente(nombre="Cliente test", documento="12345678", telefono="11111111", email="c@test.local")
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        salida = Salida(
            lote_id=lote.id,
            cliente_id=cliente.id,
            estado=ESTADO_ENTREGADO,
            cantidad=Decimal("100"),
            fecha_reserva=date.today(),
            forma_entrega="RETIRA_CLIENTE",
        )
        db.add(salida)
        db.commit()

    return lote


def test_listar_vencimientos_incluye_lotes_terminados(db_session, monkeypatch):
    from src.common.fechas import hoy
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10), margen_dias=15)
    vence = date(2025, 6, 20)  # 10 días -> PROXIMO
    _lote_terminado_con_vencimiento(db_session, numero="LP-001", vence=vence)

    resultado = listar_vencimientos(db_session, tipo="LOTE")

    assert len(resultado) == 1
    assert resultado[0].tipo == "LOTE"
    assert resultado[0].detalle == "Lote LP-001"
    assert resultado[0].dias_restantes == 10
    assert resultado[0].estado == "PROXIMO"
    assert resultado[0].link_destino == "/lotes/1"


def test_listar_vencimientos_excluye_lotes_cancelados_y_retirados(db_session, monkeypatch):
    from src.lotes.models import LoteProducto
    from src.productos.models import Producto
    from src.unidadMedida.models import UnidadMedida
    from src.retiros.models import Retiro
    from src.retiros.constants import ESTADO_RETIRO_CERRADO

    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10), margen_dias=15)
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa")
    producto = Producto(nombre="Producto retirado", unidad_medida=unidad)
    db_session.add_all([unidad, producto])
    db_session.commit()
    db_session.refresh(producto)

    lote = LoteProducto(
        numero_lote="LP-RETIRADO",
        producto=producto,
        estado="terminado",
        cantidad_objetivo=Decimal("100"),
        cantidad_producida=Decimal("100"),
        fecha_vencimiento=date(2025, 6, 20),
        retirado=True,
    )
    db_session.add(lote)
    db_session.commit()

    resultado = listar_vencimientos(db_session, tipo="LOTE")
    assert len(resultado) == 0


def test_listar_vencimientos_excluye_lotes_sin_saldo(db_session, monkeypatch):
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10), margen_dias=15)
    _lote_terminado_con_vencimiento(
        db_session, numero="LP-SIN-SALDO", vence=date(2025, 6, 20), saldo_positivo=False
    )

    resultado = listar_vencimientos(db_session, tipo="LOTE")
    assert len(resultado) == 0


def test_listar_vencimientos_tipo_lote_no_aparece_otro_tipo(db_session, monkeypatch):
    _mock_hoy_y_margen(monkeypatch, date(2025, 6, 10), margen_dias=15)
    _lote_terminado_con_vencimiento(db_session, numero="LP-002", vence=date(2025, 6, 20))

    resultado = listar_vencimientos(db_session, tipo="PERSONAL")
    assert len(resultado) == 0

