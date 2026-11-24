"""Tests de la ficha del incidente (`src.incidente.detalle`)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from src.common.fechas import ahora, hoy
from src.incidente import exceptions
from src.incidente.detalle import MAXIMO_RELACIONADOS, obtener_detalle
from src.incidente.models import Incidente
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.reclamos.models import Reclamo
from src.reposiciones.models import Reposicion
from src.retiros.models import Retiro
from tests.database import db_session
from tests.incidente.test_services import (
    _equipo,
    _personal_admin,
    _personal_operador,
    _sector,
)
from tests.salidas.test_services import _cliente, _lote, _salida


def _guardar(db, fila):
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _incidente(db, usuario, **datos):
    datos.setdefault("tipo", "otro")
    return _guardar(
        db,
        Incidente(
            titulo="Incidente",
            descripcion="Descripción",
            usuario_id=usuario.id,
            fecha_reporte=ahora(),
            **datos,
        ),
    )


def _reposicion(db, cliente, lote, **datos):
    return _guardar(
        db,
        Reposicion(
            cliente_id=cliente.id,
            producto_id=lote.producto_id,
            cantidad_original=Decimal("5"),
            cantidad_pendiente=Decimal("5"),
            origen="RECHAZO_ENTREGA",
            **datos,
        ),
    )


def test_incidente_suelto_no_trae_vinculos(db_session):
    admin = _personal_admin(db_session)
    incidente = _incidente(db_session, admin)

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.usuario_nombre == "Admin A"
    assert ficha.equipo is None
    assert ficha.lote is None
    assert ficha.salida is None
    assert ficha.reclamo is None
    assert ficha.retiro is None
    assert ficha.reposiciones == []
    assert ficha.relacionados == []
    assert ficha.relacionados_total == 0


def test_equipo_trae_sector_y_solo_planes_activos(db_session):
    admin = _personal_admin(db_session)
    equipo = _equipo(db_session, _sector(db_session, "Cocina").id)
    for tipo, activo in (("calibracion", True), ("mantenimiento", False)):
        _guardar(
            db_session,
            PlanCalibracionMantenimiento(
                equipo_id=equipo.id,
                autor_id=admin.id,
                tipo=tipo,
                fecha_ultima_intervencion=hoy() - timedelta(days=40),
                periodicidad_dias=30,
                activo=activo,
            ),
        )
    incidente = _incidente(
        db_session, admin, tipo="falla_equipo", equipo_id=equipo.id
    )

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.equipo.nombre == equipo.nombre
    assert ficha.equipo.sector_nombre == "Cocina"
    assert [p.tipo for p in ficha.equipo.planes] == ["calibracion"]
    assert ficha.equipo.planes[0].dias_restantes == -10


def test_relacionados_del_mismo_equipo_con_tope_y_total(db_session):
    admin = _personal_admin(db_session)
    equipo = _equipo(db_session, _sector(db_session).id)
    incidente = _incidente(db_session, admin, equipo_id=equipo.id)
    for _ in range(MAXIMO_RELACIONADOS + 2):
        _incidente(db_session, admin, equipo_id=equipo.id)
    _incidente(db_session, admin)  # sin equipo: no es relacionado

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.relacionados_total == MAXIMO_RELACIONADOS + 2
    assert len(ficha.relacionados) == MAXIMO_RELACIONADOS
    assert incidente.id not in [r.id for r in ficha.relacionados]


def test_operador_no_ve_relacionados_ajenos(db_session):
    admin = _personal_admin(db_session)
    operador = _personal_operador(db_session)
    equipo = _equipo(db_session, _sector(db_session).id)
    propio = _incidente(db_session, operador, equipo_id=equipo.id)
    otro_propio = _incidente(db_session, operador, equipo_id=equipo.id)
    ajeno = _incidente(db_session, admin, equipo_id=equipo.id)

    ficha = obtener_detalle(db_session, propio.id, operador)

    assert [r.id for r in ficha.relacionados] == [otro_propio.id]
    assert ficha.relacionados_total == 1
    with pytest.raises(exceptions.PermisoDenegado):
        obtener_detalle(db_session, ajeno.id, operador)


def test_rechazo_trae_salida_lote_y_reposicion_de_la_salida(db_session):
    admin = _personal_admin(db_session)
    lote = _lote(db_session)
    cliente = _cliente(db_session, nombre="Almacén Sur")
    salida = _salida(db_session, lote.id, cliente.id, estado="RECHAZADA")
    incidente = _incidente(
        db_session,
        admin,
        tipo="entrega_rechazada",
        lote_id=lote.id,
        salida_id=salida.id,
    )
    reposicion = _reposicion(db_session, cliente, lote, salida_origen_id=salida.id)

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.salida.cliente_nombre == "Almacén Sur"
    assert ficha.lote.numero_lote == lote.numero_lote
    assert [r.id for r in ficha.reposiciones] == [reposicion.id]


def test_reclamo_no_muestra_reposiciones_de_otro_reclamo(db_session):
    admin = _personal_admin(db_session)
    lote = _lote(db_session)
    cliente = _cliente(db_session)
    salida = _salida(db_session, lote.id, cliente.id, estado="ENTREGADO")
    vinculo = {"tipo": "reclamo_cliente", "lote_id": lote.id, "salida_id": salida.id}
    incidente = _incidente(db_session, admin, **vinculo)
    otro = _incidente(db_session, admin, **vinculo)
    reclamo = _guardar(
        db_session,
        Reclamo(
            salida_id=salida.id,
            lote_id=lote.id,
            cliente_id=cliente.id,
            incidente_id=incidente.id,
            fecha_reclamo=date(2026, 1, 20),
            motivo="envase_danado",
            fecha_entrega_ref=date(2026, 1, 10),
            dias_desde_entrega=10,
            plazo_referencia_dias=7,
            fuera_de_plazo=True,
            registrado_por_id=admin.id,
        ),
    )
    # `reclamo_a_resumen` toma la fecha de la salida, no la copia del reclamo.
    salida.fecha_entrega = date(2026, 1, 10)
    _guardar(db_session, salida)
    _reposicion(
        db_session,
        cliente,
        lote,
        salida_origen_id=salida.id,
        incidente_origen_id=otro.id,
    )

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.reclamo.id == reclamo.id
    assert ficha.reclamo.motivo_label == "Envase dañado"
    assert ficha.reposiciones == []
    assert [r.id for r in ficha.relacionados] == [otro.id]


def test_retiro_trae_avance_de_notificaciones(db_session):
    admin = _personal_admin(db_session)
    lote = _lote(db_session, retirado=True)
    incidente = _incidente(db_session, admin, tipo="retiro_lote", lote_id=lote.id)
    retiro = _guardar(
        db_session,
        Retiro(
            lote_id=lote.id,
            motivo="Otro",
            fecha_retiro=date(2026, 1, 20),
            iniciado_por_id=admin.id,
            origen="MANUAL",
            incidente_id=incidente.id,
        ),
    )

    ficha = obtener_detalle(db_session, incidente.id, admin)

    assert ficha.retiro.id == retiro.id
    assert ficha.retiro.total_afectados == 0
    assert ficha.lote.retirado is True


def test_salida_inexistente_no_rompe_la_ficha(db_session):
    admin = _personal_admin(db_session)
    incidente = _incidente(db_session, admin, salida_id=9999)

    assert obtener_detalle(db_session, incidente.id, admin).salida is None
