"""Tests de services del módulo de salidas de producto."""

from datetime import date, datetime
from decimal import Decimal

import pytest

from src.clientes.models import Cliente
from src.lotes.models import LoteProducto
from src.personal.models import Personal
from src.productos.models import Producto
from src.salidas import exceptions, services
from src.salidas.models import HitoLote, Salida, calcular_cantidades
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


def _unidad_medida(db, simbolo="kg"):
    fila = UnidadMedida(simbolo=simbolo, nombre="Kilogramo")
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _producto(db, unidad_medida_id=1, nombre="Producto Test"):
    fila = Producto(
        nombre=nombre,
        activo=True,
        unidad_medida_id=unidad_medida_id,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _personal(db, nombre="Omar", apellido="Operador", dni="10000002", operar=True, admin=False):
    fila = Personal(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        email=f"{dni}@test.local",
        password="x",
        puede_operar=operar,
        puede_administrar=admin,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _cliente(db, nombre="Cliente Test", documento="100000001", activo=True):
    fila = Cliente(
        nombre=nombre,
        documento=documento,
        telefono="11-1234-5678",
        activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _lote(
    db,
    numero_lote="LP-20260101-001",
    cantidad_producida=Decimal("100.000"),
    retirado=False,
    fecha_inicio=None,
):
    # Asegurar dependencias: unidad de medida, producto y creado_por.
    _unidad_medida(db)
    _producto(db, unidad_medida_id=1)
    creador = _personal(db, dni="10000001", operar=True, admin=True)
    if fecha_inicio is None:
        fecha_inicio = datetime(2026, 1, 1, 10, 0, 0)
    fila = LoteProducto(
        numero_lote=numero_lote,
        producto_id=1,
        estado="terminado",
        cantidad_objetivo=cantidad_producida,
        cantidad_producida=cantidad_producida,
        creado_por_id=creador.id,
        fecha_inicio=fecha_inicio,
        fecha_cierre=datetime(2026, 1, 2, 10, 0, 0),
        retirado=retirado,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _salida(
    db,
    lote_id,
    cliente_id,
    cantidad=Decimal("10.000"),
    estado="RESERVADO",
    fecha_reserva=date(2026, 1, 5),
    fecha_despacho=None,
):
    fila = Salida(
        lote_id=lote_id,
        cliente_id=cliente_id,
        cantidad=cantidad,
        fecha_reserva=fecha_reserva,
        fecha_despacho=fecha_despacho,
        estado=estado,
        creado_por_id=1,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# calcular_cantidades (función pura)
# ---------------------------------------------------------------------------

def test_calcular_cantidades_sin_salidas():
    resultado = calcular_cantidades(Decimal("100.000"), [], False)
    assert resultado["reservado"] == Decimal("0")
    assert resultado["despachado"] == Decimal("0")
    assert resultado["entregado"] == Decimal("0")
    assert resultado["saldo"] == Decimal("100.000")
    assert resultado["estado_lote"] == "En almacén"


def test_calcular_cantidades_con_reserva_parcial():
    salidas = [
        Salida(cantidad=Decimal("30.000"), estado="RESERVADO"),
        Salida(cantidad=Decimal("20.000"), estado="DESPACHADO"),
    ]
    resultado = calcular_cantidades(Decimal("100.000"), salidas, False)
    assert resultado["reservado"] == Decimal("30.000")
    assert resultado["despachado"] == Decimal("20.000")
    assert resultado["entregado"] == Decimal("0")
    assert resultado["saldo"] == Decimal("50.000")
    assert resultado["estado_lote"] == "Con salidas parciales"


def test_calcular_cantidades_agotado():
    salidas = [Salida(cantidad=Decimal("100.000"), estado="RESERVADO")]
    resultado = calcular_cantidades(Decimal("100.000"), salidas, False)
    assert resultado["saldo"] == Decimal("0")
    assert resultado["estado_lote"] == "Agotado"


def test_calcular_cantidades_retirado_prioridad():
    salidas = []  # sin salidas, saldo == producido
    resultado = calcular_cantidades(Decimal("100.000"), salidas, True)
    assert resultado["saldo"] == Decimal("100.000")
    assert resultado["estado_lote"] == "Retirado"


def test_calcular_cantidades_cancelada_no_suma():
    salidas = [Salida(cantidad=Decimal("50.000"), estado="CANCELADO")]
    resultado = calcular_cantidades(Decimal("100.000"), salidas, False)
    assert resultado["reservado"] == Decimal("0")
    assert resultado["saldo"] == Decimal("100.000")
    assert resultado["estado_lote"] == "En almacén"


def test_calcular_cantidades_decimales_sin_redondeo():
    salidas = [
        Salida(cantidad=Decimal("10.001"), estado="RESERVADO"),
        Salida(cantidad=Decimal("10.002"), estado="RESERVADO"),
    ]
    resultado = calcular_cantidades(Decimal("30.000"), salidas, False)
    assert resultado["reservado"] == Decimal("20.003")
    assert resultado["saldo"] == Decimal("9.997")


# ---------------------------------------------------------------------------
# registrar_hito (no hace commit)
# ---------------------------------------------------------------------------

def test_registrar_hito_no_hace_commit(db_session):
    lote = _lote(db_session)
    usuario = _personal(db_session)

    hito = services.registrar_hito(
        db_session,
        lote_id=lote.id,
        tipo_evento="RESERVA",
        descripcion="Reserva de prueba",
        usuario_id=usuario.id,
    )

    # Sin commit, no debería persistirse.
    db_session.rollback()
    encontrado = db_session.get(HitoLote, hito.id)
    assert encontrado is None


def test_registrar_hito_con_commit(db_session):
    lote = _lote(db_session)
    usuario = _personal(db_session)

    hito = services.registrar_hito(
        db_session,
        lote_id=lote.id,
        tipo_evento="RESERVA",
        descripcion="Reserva de prueba",
        usuario_id=usuario.id,
    )
    db_session.commit()

    encontrado = db_session.get(HitoLote, hito.id)
    assert encontrado is not None
    assert encontrado.descripcion == "Reserva de prueba"
    assert encontrado.usuario_id == usuario.id
    assert encontrado.tipo_evento == "RESERVA"


# ---------------------------------------------------------------------------
# reservar
# ---------------------------------------------------------------------------

def test_reservar_exitoso(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    salida = services.reservar(
        db_session,
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("30.000"),
        fecha_reserva=date(2026, 1, 5),
        usuario=usuario,
    )

    assert salida.estado == "RESERVADO"
    assert salida.cantidad == Decimal("30.000")

    # El lote debe tener saldo reducido.
    db_session.refresh(lote)
    assert lote.saldo == Decimal("70.000")
    assert lote.estado_lote == "Con salidas parciales"

    # Debe existir un hito.
    hitos = db_session.query(HitoLote).filter(HitoLote.lote_id == lote.id).all()
    assert len(hitos) == 1
    assert "Reserva de" in hitos[0].descripcion
    assert hitos[0].usuario_id == usuario.id
    assert hitos[0].salida_id == salida.id


def test_reservar_cantidad_igual_a_saldo_agota_lote(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("50.000"))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    services.reservar(
        db_session,
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("50.000"),
        fecha_reserva=date(2026, 1, 5),
        usuario=usuario,
    )

    db_session.refresh(lote)
    assert lote.saldo == Decimal("0")
    assert lote.estado_lote == "Agotado"


def test_reservar_cantidad_mayor_a_saldo_rechazada(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.SaldoInsuficiente):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("101.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


@pytest.mark.parametrize(
    ("tipo", "factor", "cantidad", "valida"),
    [
        ("unidad", 1, "10.5", False),  # no hay medio pan
        ("unidad", 1, "10", True),
        ("unidad", 12, "1.5", True),  # 1,5 docenas son 18 unidades
        ("masa", 1000, "10.5", True),  # en kg sí hay fracciones
    ],
)
def test_reservar_respeta_si_el_producto_se_cuenta_por_unidad(db_session, tipo, factor, cantidad, valida):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    unidad = lote.producto.unidad_medida
    unidad.tipo, unidad.factor_a_base = tipo, factor
    db_session.commit()
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    def reservar():
        return services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal(cantidad),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )

    if valida:
        assert reservar().cantidad == Decimal(cantidad)
    else:
        with pytest.raises(exceptions.CantidadNoEntera):
            reservar()


def test_reservar_cantidad_cero_o_negativa_rechazada(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.CantidadInvalida):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("0"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )

    with pytest.raises(exceptions.CantidadInvalida):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("-5.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


def test_reservar_lote_retirado_rechazado(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"), retirado=True)
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.LoteRetirado):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("10.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


def test_reservar_cliente_inactivo_rechazado(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    cliente = _cliente(db_session, activo=False)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.ClienteInactivo):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("10.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


def test_reservar_cliente_inexistente_rechazado(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    usuario = _personal(db_session)

    with pytest.raises(exceptions.ClienteNoEncontrado):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=99999,
            cantidad=Decimal("10.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


def test_reservar_lote_inexistente_rechazado(db_session):
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.LoteNoEncontrado):
        services.reservar(
            db_session,
            lote_id=99999,
            cliente_id=cliente.id,
            cantidad=Decimal("10.000"),
            fecha_reserva=date(2026, 1, 5),
            usuario=usuario,
        )


def test_reservar_fecha_anterior_a_elaboracion_rechazada(db_session):
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"), fecha_inicio=datetime(2026, 3, 1))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    with pytest.raises(exceptions.FechaAnteriorAElaboracion):
        services.reservar(
            db_session,
            lote_id=lote.id,
            cliente_id=cliente.id,
            cantidad=Decimal("10.000"),
            fecha_reserva=date(2026, 2, 1),
            usuario=usuario,
        )


def test_reservar_es_atomico(db_session):
    """La salida y el hito se guardan en una sola transacción (un commit)."""
    lote = _lote(db_session, cantidad_producida=Decimal("100.000"))
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    salida = services.reservar(
        db_session,
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("10.000"),
        fecha_reserva=date(2026, 1, 5),
        usuario=usuario,
    )

    # Ambos existen tras un único commit.
    assert salida.id is not None
    hitos = db_session.query(HitoLote).filter(HitoLote.lote_id == lote.id).all()
    assert len(hitos) == 1
    assert hitos[0].salida_id == salida.id


# ---------------------------------------------------------------------------
# listar_salidas
# ---------------------------------------------------------------------------

def test_listar_salidas_con_filtros(db_session):
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    _salida(db_session, lote_id=lote.id, cliente_id=cliente.id, estado="RESERVADO")
    _salida(db_session, lote_id=lote.id, cliente_id=cliente.id, estado="CANCELADO")

    resultado = services.listar_salidas(db_session, estado="RESERVADO")
    assert len(resultado) == 1
    assert resultado[0].estado == "RESERVADO"

    resultado_lote = services.listar_salidas(db_session, lote_id=lote.id)
    assert len(resultado_lote) == 2

    resultado_cliente = services.listar_salidas(db_session, cliente_id=cliente.id)
    assert len(resultado_cliente) == 2


def test_listar_salidas_orden_fecha_descendente(db_session):
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    _salida(db_session, lote_id=lote.id, cliente_id=cliente.id, fecha_reserva=date(2026, 1, 1))
    _salida(db_session, lote_id=lote.id, cliente_id=cliente.id, fecha_reserva=date(2026, 1, 5))

    resultado = services.listar_salidas(db_session)
    assert resultado[0].fecha_reserva == date(2026, 1, 5)
    assert resultado[1].fecha_reserva == date(2026, 1, 1)


# ---------------------------------------------------------------------------
# despachar / entregar: momentos exactos de cada acción
# ---------------------------------------------------------------------------

def test_despachar_registra_momento(db_session):
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    salida = _salida(db_session, lote.id, cliente.id)

    services.despachar(
        db_session,
        salida.id,
        "RETIRA_CLIENTE",
        None,
        date(2026, 1, 5),
        usuario,
    )

    db_session.refresh(salida)
    assert salida.estado == "DESPACHADO"
    assert salida.despachado_en is not None
    assert salida.entregado_en is None


def test_entregar_registra_momento(db_session):
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    salida = _salida(
        db_session,
        lote.id,
        cliente.id,
        estado="DESPACHADO",
        fecha_despacho=date(2026, 1, 5),
    )

    services.entregar(
        db_session,
        salida.id,
        date(2026, 1, 6),
        None,
        usuario,
    )

    db_session.refresh(salida)
    assert salida.estado == "ENTREGADO"
    assert salida.entregado_en is not None


def test_salida_a_resumen_incluye_elaboracion_y_momentos(db_session):
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    usuario = _personal(db_session)

    salida = _salida(db_session, lote.id, cliente.id)
    services.despachar(
        db_session,
        salida.id,
        "RETIRA_CLIENTE",
        None,
        date(2026, 1, 5),
        usuario,
    )

    detalle = services.obtener_salida(db_session, salida.id)
    resumen = services.salida_a_resumen(detalle)

    assert resumen.fecha_elaboracion == date(2026, 1, 1)
    assert resumen.despachado_en is not None
    assert resumen.entregado_en is None
