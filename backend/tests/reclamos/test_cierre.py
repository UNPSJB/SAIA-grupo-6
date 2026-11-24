"""Tests del cierre y la reapertura de un reclamo de cliente."""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from src.incidente import exceptions as incidente_exceptions
from src.incidente.models import HistorialIncidente
from src.incidente.services import listar_incidentes
from src.reclamos import exceptions, services
from src.reclamos.schemas import ReclamoCerrar
from src.reposiciones.models import Reposicion
from tests.database import db_session
from tests.incidente.test_services import _personal_admin
from tests.salidas.test_services import _cliente, _lote, _salida


@pytest.fixture
def escenario(db_session):
    admin = _personal_admin(db_session)
    lote = _lote(db_session)
    salida = _salida(
        db_session, lote.id, _cliente(db_session).id, estado="ENTREGADO"
    )
    salida.fecha_entrega = date(2026, 1, 10)
    db_session.commit()
    reclamo = services.crear_reclamo(
        db_session,
        salida_id=salida.id,
        motivo="envase_danado",
        detalle=None,
        fecha_reclamo=date(2026, 1, 12),
        usuario=admin,
    )
    return admin, reclamo


def _reposiciones(db):
    return db.scalars(select(Reposicion)).all()


def test_cerrar_cierra_el_incidente_y_lo_asienta(db_session, escenario):
    admin, reclamo = escenario

    cerrado = services.cerrar_reclamo(
        db_session, reclamo.id, ReclamoCerrar(accion_correctiva=" Se revisó "), admin
    )

    assert cerrado.incidente.estado == "cerrado"
    assert cerrado.incidente.observacion_cierre == "Se revisó"
    assert cerrado.incidente.responsable_cierre_id == admin.id
    evento = db_session.scalar(select(HistorialIncidente))
    assert (evento.incidente_id, evento.estado_nuevo) == (cerrado.incidente_id, "cerrado")
    assert _reposiciones(db_session) == []


def test_cerrar_con_devolucion_y_reposicion(db_session, escenario):
    admin, reclamo = escenario

    cerrado = services.cerrar_reclamo(
        db_session,
        reclamo.id,
        ReclamoCerrar(
            accion_correctiva="Se repone",
            mercaderia_devuelta=True,
            disposicion_fisica="BAJA",
            cantidad_devuelta=Decimal("2"),
            generar_reposicion=True,
            cantidad_a_reponer=Decimal("2"),
        ),
        admin,
    )

    assert "Mercadería devuelta a planta" in cerrado.incidente.observacion_cierre
    assert "dada de baja (descarte sanitario)" in cerrado.incidente.observacion_cierre
    assert cerrado.cantidad_devuelta == Decimal("2")
    (reposicion,) = _reposiciones(db_session)
    assert reposicion.cliente_id == reclamo.cliente_id
    assert reposicion.producto_id == reclamo.lote.producto_id
    assert reposicion.cantidad_pendiente == Decimal("2")
    assert reposicion.incidente_origen_id == reclamo.incidente_id
    assert reposicion.salida_origen_id == reclamo.salida_id


def test_cerrar_sin_accion_correctiva_no_deja_nada_guardado(db_session, escenario):
    admin, reclamo = escenario

    with pytest.raises(incidente_exceptions.ObservacionCierreRequerida):
        services.cerrar_reclamo(
            db_session,
            reclamo.id,
            ReclamoCerrar(
                accion_correctiva="  ",
                mercaderia_devuelta=True,
                disposicion_fisica="BAJA",
                cantidad_devuelta=Decimal("1"),
                generar_reposicion=True,
                cantidad_a_reponer=1,
            ),
            admin,
        )

    db_session.rollback()
    assert services.obtener_reclamo(db_session, reclamo.id).incidente.estado == "abierto"
    assert _reposiciones(db_session) == []


def test_no_se_cierra_dos_veces(db_session, escenario):
    admin, reclamo = escenario
    datos = ReclamoCerrar(
        accion_correctiva="Listo", generar_reposicion=True, cantidad_a_reponer=1
    )
    services.cerrar_reclamo(db_session, reclamo.id, datos, admin)

    with pytest.raises(exceptions.ReclamoYaCerrado):
        services.cerrar_reclamo(db_session, reclamo.id, datos, admin)
    assert len(_reposiciones(db_session)) == 1


def test_reabrir_limpia_el_cierre_y_conserva_el_historial(db_session, escenario):
    admin, reclamo = escenario
    with pytest.raises(exceptions.ReclamoNoCerrado):
        services.reabrir_reclamo(db_session, reclamo.id, None, admin)
    services.cerrar_reclamo(
        db_session, reclamo.id, ReclamoCerrar(accion_correctiva="Listo"), admin
    )

    abierto = services.reabrir_reclamo(db_session, reclamo.id, " Volvió ", admin)

    assert abierto.incidente.estado == "abierto"
    assert abierto.incidente.observacion_cierre is None
    eventos = db_session.scalars(
        select(HistorialIncidente).order_by(HistorialIncidente.id)
    ).all()
    assert [(e.estado_nuevo, e.observacion) for e in eventos] == [
        ("cerrado", "Listo"),
        ("abierto", "Volvió"),
    ]


def test_el_listado_de_incidentes_dice_en_que_reclamo_se_resuelve(db_session, escenario):
    _, reclamo = escenario

    (incidente,) = listar_incidentes(db_session)

    assert incidente.reclamo_id == reclamo.id


@pytest.mark.parametrize(
    "datos",
    [
        {"mercaderia_devuelta": True},
        {"generar_reposicion": True},
        {"generar_reposicion": True, "cantidad_a_reponer": 0},
        {"mercaderia_devuelta": True, "disposicion_fisica": "OTRA"},
    ],
)
def test_datos_incompletos_del_cierre_se_rechazan(datos):
    with pytest.raises(ValidationError):
        ReclamoCerrar(accion_correctiva="Listo", **datos)


def _cerrar_con_reposicion(db, reclamo, admin, cantidad=2):
    return services.cerrar_reclamo(
        db,
        reclamo.id,
        ReclamoCerrar(
            accion_correctiva="Se repone",
            generar_reposicion=True,
            cantidad_a_reponer=cantidad,
        ),
        admin,
    )


@pytest.mark.parametrize("estado", ["PENDIENTE", "PARCIAL", "CUMPLIDA"])
def test_reabrir_y_volver_a_cerrar_no_duplica_la_deuda(db_session, escenario, estado):
    admin, reclamo = escenario
    _cerrar_con_reposicion(db_session, reclamo, admin)
    (primera,) = _reposiciones(db_session)
    primera.estado = estado
    db_session.commit()
    services.reabrir_reclamo(db_session, reclamo.id, None, admin)

    with pytest.raises(exceptions.ReposicionYaGenerada):
        _cerrar_con_reposicion(db_session, reclamo, admin)

    db_session.rollback()
    assert services.obtener_reclamo(db_session, reclamo.id).incidente.estado == "abierto"
    assert len(_reposiciones(db_session)) == 1
    # Sin pedir otra reposición, se cierra igual.
    services.cerrar_reclamo(
        db_session, reclamo.id, ReclamoCerrar(accion_correctiva="Listo"), admin
    )
    assert len(_reposiciones(db_session)) == 1


def test_una_reposicion_anulada_permite_generar_otra(db_session, escenario):
    admin, reclamo = escenario
    _cerrar_con_reposicion(db_session, reclamo, admin)
    (primera,) = _reposiciones(db_session)
    primera.estado = "ANULADA"
    db_session.commit()
    services.reabrir_reclamo(db_session, reclamo.id, None, admin)

    _cerrar_con_reposicion(db_session, reclamo, admin, cantidad=3)

    assert len(_reposiciones(db_session)) == 2


def test_la_ficha_trae_la_reposicion_vigente(db_session, escenario):
    admin, reclamo = escenario
    assert services.reclamo_a_detalle(reclamo).reposicion is None

    cerrado = _cerrar_con_reposicion(db_session, reclamo, admin)

    reposicion = services.reclamo_a_detalle(cerrado).reposicion
    assert reposicion.estado == "PENDIENTE"
    assert reposicion.cantidad_pendiente == 2


def test_devolucion_impacta_en_cantidades_del_lote(db_session, escenario):
    admin, reclamo = escenario
    lote = reclamo.lote
    entregado_inicial = lote.entregado
    desechado_inicial = lote.desechado
    saldo_inicial = lote.saldo

    services.cerrar_reclamo(
        db_session,
        reclamo.id,
        ReclamoCerrar(
            accion_correctiva="Se descartó en planta",
            mercaderia_devuelta=True,
            cantidad_devuelta=Decimal("2"),
        ),
        admin,
    )

    db_session.expire_all()
    lote_actualizado = db_session.get(type(lote), lote.id)
    assert lote_actualizado.entregado == entregado_inicial - Decimal("2")
    assert lote_actualizado.desechado == desechado_inicial + Decimal("2")
    assert lote_actualizado.saldo == saldo_inicial


def test_cantidad_devuelta_no_puede_superar_disponible(db_session, escenario):
    admin, reclamo = escenario
    salida_cant = reclamo.salida.cantidad

    with pytest.raises(exceptions.CantidadDevueltaSuperada):
        services.cerrar_reclamo(
            db_session,
            reclamo.id,
            ReclamoCerrar(
                accion_correctiva="Devolución excesiva",
                mercaderia_devuelta=True,
                cantidad_devuelta=salida_cant + Decimal("1"),
            ),
            admin,
        )


def test_reabrir_y_reintentar_devolucion_no_permitida(db_session, escenario):
    admin, reclamo = escenario
    services.cerrar_reclamo(
        db_session,
        reclamo.id,
        ReclamoCerrar(
            accion_correctiva="Devuelto inicial",
            mercaderia_devuelta=True,
            cantidad_devuelta=Decimal("1"),
        ),
        admin,
    )

    services.reabrir_reclamo(db_session, reclamo.id, "Reapertura", admin)

    with pytest.raises(exceptions.DevolucionYaRegistrada):
        services.cerrar_reclamo(
            db_session,
            reclamo.id,
            ReclamoCerrar(
                accion_correctiva="Segunda devolución",
                mercaderia_devuelta=True,
                cantidad_devuelta=Decimal("1"),
            ),
            admin,
        )
