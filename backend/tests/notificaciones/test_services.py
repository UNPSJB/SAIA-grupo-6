"""Tests unitarios de services del módulo `notificaciones`."""

from datetime import date

from sqlalchemy import select

from src.elementoLimpieza.models import ElementoLimpieza
from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico
from src.notificaciones import schemas
from src.notificaciones.models import ConfiguracionAlerta, NotificacionPersistida
from src.notificaciones.services import (
    actualizar_dias_alerta_vencimiento_personal,
    calcular_filas_notificaciones,
    obtener_dias_alerta_vencimiento_personal,
    obtener_notificaciones_elementos_limpieza,
    obtener_notificaciones_planes_calibracion_mantenimiento,
    obtener_notificaciones_stock_bajo,
    obtener_notificaciones_vencimientos_personal,
    obtener_todas_notificaciones,
    recalcular_notificaciones_persistidas,
)
from src.Equipo.models import Equipo
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.aptitud.models import Aptitud
from src.personal.models import Personal
from src.sector.models import Sector
from src.unidadMedida.models import UnidadMedida
from src.vencimientoPersonal.models import VencimientoPersonal
from tests.database import db_session


# ---------------------------------------------------------------------------
# Helpers locales
# ---------------------------------------------------------------------------

def _mock_hoy(monkeypatch, fecha):
    monkeypatch.setattr("src.common.fechas.hoy", lambda: fecha)
    monkeypatch.setattr("src.notificaciones.services.hoy", lambda: fecha)


def _personal_admin(db, dni="12345678", email="a@test.com"):
    fila = Personal(
        nombre="Admin", apellido="A", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=True, es_super_admin=False,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _sector(db, nombre="Sector", activo=True):
    fila = Sector(nombre=nombre, descripcion="d", activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _equipo(db, sector_id, nombre="Equipo 1", activo=True):
    fila = Equipo(nombre=nombre, tipo="T", sector_id=sector_id, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _personal(db, dni="12345678", email="p@test.com", activo=True):
    fila = Personal(
        nombre="Persona", apellido="Test", dni=dni, email=email,
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


def _um(db, nombre="Unidad", simbolo="UN", activo=True):
    fila = UnidadMedida(nombre=nombre, simbolo=simbolo, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# obtener_dias_alerta_vencimiento_personal
# ---------------------------------------------------------------------------

def test_obtener_dias_alerta_valor_por_defecto(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    dias = obtener_dias_alerta_vencimiento_personal(db_session)

    # Assert
    assert dias == 15


def test_obtener_dias_alerta_valor_configurado(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    config = ConfiguracionAlerta(
        clave="dias_alerta_vencimiento_personal", valor=10
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(config)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    dias = obtener_dias_alerta_vencimiento_personal(db_session)

    # Assert
    assert dias == 10


# ---------------------------------------------------------------------------
# actualizar_dias_alerta_vencimiento_personal
# ---------------------------------------------------------------------------

def test_actualizar_dias_alerta_crea_configuracion(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = actualizar_dias_alerta_vencimiento_personal(db_session, 20)

    # Assert
    assert resultado == 20
    config = db_session.get(ConfiguracionAlerta, {"establecimiento_id": 1, "clave": "dias_alerta_vencimiento_personal"})
    assert config is not None
    assert config.valor == 20


def test_actualizar_dias_alerta_actualiza_existente(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    config = ConfiguracionAlerta(
        clave="dias_alerta_vencimiento_personal", valor=5
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(config)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = actualizar_dias_alerta_vencimiento_personal(db_session, 30)

    # Assert
    assert resultado == 30
    config = db_session.get(ConfiguracionAlerta, {"establecimiento_id": 1, "clave": "dias_alerta_vencimiento_personal"})
    assert config.valor == 30


# ---------------------------------------------------------------------------
# obtener_notificaciones_elementos_limpieza
# ---------------------------------------------------------------------------

def test_obtener_notificaciones_elementos_limpieza_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = obtener_notificaciones_elementos_limpieza(db_session)

    # Assert
    assert resultado == []


def test_obtener_notificaciones_elemento_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2025, 5, 1),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_elementos_limpieza(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "ELEMENTO_LIMPIEZA"
    assert resultado[0].nivel == "VENCIDO"
    assert resultado[0].entidad_id == elem.id


def test_obtener_notificaciones_elemento_proximo_a_vencer(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Jabon",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_elementos_limpieza(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nivel == "PROXIMO_A_VENCER"
    assert "día(s)" in resultado[0].mensaje


def test_obtener_notificaciones_elemento_inactivo_no_aparece(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Inactivo",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2025, 5, 1),
        activo=False,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_elementos_limpieza(db_session)

    # Assert
    assert resultado == []


# ---------------------------------------------------------------------------
# obtener_notificaciones_planes_calibracion_mantenimiento
# ---------------------------------------------------------------------------

def test_obtener_notificaciones_planes_calibracion_mantenimiento_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = obtener_notificaciones_planes_calibracion_mantenimiento(db_session)

    # Assert
    assert resultado == []


def test_obtener_notificaciones_plan_calibracion_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    # fecha_ultima_intervencion 2025-03-01, periodicidad 60 -> vence 2025-04-30 (vencido)
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id, autor_id=autor.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 3, 1), periodicidad_dias=60,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(plan)
        db_session.commit()
        db_session.refresh(plan)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_planes_calibracion_mantenimiento(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "PLAN_CALIBRACION"
    assert resultado[0].nivel == "VENCIDO"


# ---------------------------------------------------------------------------
# obtener_notificaciones_vencimientos_personal
# ---------------------------------------------------------------------------

def test_obtener_notificaciones_vencimientos_personal_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = obtener_notificaciones_vencimientos_personal(db_session)

    # Assert
    assert resultado == []


def test_obtener_notificaciones_vencimiento_personal_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    # vence 2025-05-31 (vencido)
    vp = VencimientoPersonal(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 5, 31), activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
        db_session.refresh(vp)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_vencimientos_personal(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "VENCIMIENTO_PERSONAL"
    assert resultado[0].nivel == "VENCIDO"


def test_obtener_notificaciones_vencimiento_personal_inactivo_no_aparece(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session, activo=False)
    aptitud = _aptitud(db_session)
    vp = VencimientoPersonal(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 5, 31), activo=False,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
        db_session.refresh(vp)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_vencimientos_personal(db_session)

    # Assert
    assert resultado == []


# ---------------------------------------------------------------------------
# obtener_notificaciones_stock_bajo
# ---------------------------------------------------------------------------

def test_obtener_notificaciones_stock_bajo_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = obtener_notificaciones_stock_bajo(db_session)

    # Assert
    assert resultado == []


def test_obtener_notificaciones_stock_bajo(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    um = _um(db_session)
    iq = InsumoQuimico(
        nombre="Detergente", tipo="detergente", unidad_medida_id=um.id, activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(iq)
        db_session.commit()
        db_session.refresh(iq)
        stock = StockInsumoQuimico(
            insumo_quimico_id=iq.id, cantidad_actual=2,
            stock_minimo=5,
        )
        db_session.add(stock)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_stock_bajo(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "STOCK_BAJO"


def test_obtener_notificaciones_stock_bajo_no_bajo(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    um = _um(db_session)
    iq = InsumoQuimico(
        nombre="Detergente", tipo="detergente", unidad_medida_id=um.id, activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(iq)
        db_session.commit()
        db_session.refresh(iq)
        stock = StockInsumoQuimico(
            insumo_quimico_id=iq.id, cantidad_actual=10,
            stock_minimo=5,
        )
        db_session.add(stock)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = obtener_notificaciones_stock_bajo(db_session)

    # Assert
    assert resultado == []


# ---------------------------------------------------------------------------
# calcular_filas_notificaciones / recalcular_notificaciones_persistidas /
# obtener_todas_notificaciones
# ---------------------------------------------------------------------------

def test_calcular_filas_notificaciones_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    filas = calcular_filas_notificaciones(db_session)

    # Assert
    assert filas == []


def test_calcular_filas_notificaciones_con_datos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    filas = calcular_filas_notificaciones(db_session)

    # Assert
    assert len(filas) >= 1


def test_recalcular_notificaciones_persistidas_inmediato(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    total = recalcular_notificaciones_persistidas(db_session, inmediato=True)

    # Assert
    assert total >= 1
    filas = db_session.scalars(select(NotificacionPersistida)).all()
    assert len(filas) >= 1


def test_obtener_todas_notificaciones_vacia(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = obtener_todas_notificaciones(db_session)

    # Assert
    assert resultado == []


def test_obtener_todas_notificaciones_con_datos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    resultado = obtener_todas_notificaciones(db_session)

    # Assert
    assert len(resultado) >= 1
    assert any(r.tipo == "ELEMENTO_LIMPIEZA" for r in resultado)


def test_obtener_todas_notificaciones_buscar(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    resultado = obtener_todas_notificaciones(db_session, buscar="detergente")

    # Assert
    assert len(resultado) == 1
    assert "detergente" in resultado[0].titulo.lower() or "detergente" in resultado[0].mensaje.lower()


def test_calcular_filas_notificaciones_con_vencimiento_personal(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    vp = VencimientoPersonal(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 5, 31), activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    filas = calcular_filas_notificaciones(db_session)

    # Assert
    assert len(filas) >= 1
    assert any(f["tipo"] == "VENCIMIENTO_PERSONAL" for f in filas)


def test_obtener_todas_notificaciones_con_varios_tipos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    vp = VencimientoPersonal(
        persona_id=_personal(db_session).id,
        aptitud_id=_aptitud(db_session).id,
        fecha_vencimiento=date(2025, 5, 31), activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.add(vp)
        db_session.commit()
        db_session.refresh(elem)
        db_session.refresh(vp)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    resultado = obtener_todas_notificaciones(db_session)

    # Assert
    assert len(resultado) >= 2
    tipos = {r.tipo for r in resultado}
    assert "ELEMENTO_LIMPIEZA" in tipos
    assert "VENCIMIENTO_PERSONAL" in tipos


def test_calcular_filas_notificaciones_con_planes(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id, autor_id=autor.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 3, 1), periodicidad_dias=60,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(plan)
        db_session.commit()
        db_session.refresh(plan)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    filas = calcular_filas_notificaciones(db_session)

    # Assert
    assert len(filas) >= 1
    assert any(f["tipo"] == "PLAN_CALIBRACION" for f in filas)


def test_calcular_filas_notificaciones_con_stock(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    um = _um(db_session)
    iq = InsumoQuimico(
        nombre="Detergente", tipo="detergente", unidad_medida_id=um.id, activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(iq)
        db_session.commit()
        db_session.refresh(iq)
        stock = StockInsumoQuimico(
            insumo_quimico_id=iq.id, cantidad_actual=2,
            stock_minimo=5,
        )
        db_session.add(stock)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    filas = calcular_filas_notificaciones(db_session)

    # Assert
    assert len(filas) >= 1
    assert any(f["tipo"] == "STOCK_BAJO" for f in filas)


def test_recalcular_notificaciones_persistidas_sin_inmediato(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
        db_session.refresh(elem)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act (inmediato=False por defecto, solo marca como sucia)
    total = recalcular_notificaciones_persistidas(db_session)

    # Assert
    assert total == 0  # No se recalcó inmediatamente


# ---------------------------------------------------------------------------
# Notificaciones leídas / no leídas
# ---------------------------------------------------------------------------

def test_marcar_notificacion_leida_por_usuario(db_session, monkeypatch):
    from src.notificaciones.criticidad import obtener_criticidad_dashboard
    from src.notificaciones.services import (
        marcar_notificacion_leida,
    )

    _mock_hoy(monkeypatch, date(2025, 6, 10))
    u1 = _personal_admin(db_session, dni="11111111", email="u1@test.com")
    u2 = _personal_admin(db_session, dni="22222222", email="u2@test.com")

    elem = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2025, 5, 1),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    notifs = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    assert len(notifs) >= 1
    target_id = notifs[0].id_notificacion
    assert notifs[0].leida is False

    # Marcar leída para u1
    marcar_notificacion_leida(db_session, target_id, leida=True, usuario_id=u1.id)

    # u1 la ve leída
    notifs_u1 = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    n1 = next(n for n in notifs_u1 if n.id_notificacion == target_id)
    assert n1.leida is True

    dash_u1 = obtener_criticidad_dashboard(db_session, usuario_id=u1.id)
    a1 = next(a for a in dash_u1.alertas if a.clave == target_id)
    assert a1.leida is True

    # u2 la ve NO leída
    notifs_u2 = obtener_todas_notificaciones(db_session, usuario_id=u2.id)
    n2 = next(n for n in notifs_u2 if n.id_notificacion == target_id)
    assert n2.leida is False

    dash_u2 = obtener_criticidad_dashboard(db_session, usuario_id=u2.id)
    a2 = next(a for a in dash_u2.alertas if a.clave == target_id)
    assert a2.leida is False


def test_desmarcar_notificacion_leida(db_session, monkeypatch):
    from src.notificaciones.services import marcar_notificacion_leida

    _mock_hoy(monkeypatch, date(2025, 6, 10))
    u1 = _personal_admin(db_session, dni="33333333", email="u3@test.com")

    elem = ElementoLimpieza(
        nombre="Lavandina",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2025, 5, 1),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    notifs = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    target_id = notifs[0].id_notificacion

    marcar_notificacion_leida(db_session, target_id, leida=True, usuario_id=u1.id)
    assert obtener_todas_notificaciones(db_session, usuario_id=u1.id)[0].leida is True

    marcar_notificacion_leida(db_session, target_id, leida=False, usuario_id=u1.id)
    assert obtener_todas_notificaciones(db_session, usuario_id=u1.id)[0].leida is False


def test_reactivacion_automatica_al_empeorar(db_session, monkeypatch):
    from src.notificaciones.services import marcar_notificacion_leida

    # 1. Alerta próxima a vencer el 2025-06-10 (recambio cada 3 días, hecho el 2025-06-09 -> vence 2025-06-12)
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    u1 = _personal_admin(db_session, dni="44444444", email="u4@test.com")

    elem = ElementoLimpieza(
        nombre="Esponja",
        frecuencia_recambio_dias=3,
        fecha_ultimo_recambio=date(2025, 6, 9),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elem)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    notifs = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    target = next(n for n in notifs if n.tipo == "ELEMENTO_LIMPIEZA")
    assert target.nivel == "PROXIMO_A_VENCER"

    # Marcar leída cuando estaba próxima a vencer
    marcar_notificacion_leida(db_session, target.id_notificacion, leida=True, usuario_id=u1.id)
    assert next(n for n in obtener_todas_notificaciones(db_session, usuario_id=u1.id) if n.id_notificacion == target.id_notificacion).leida is True

    # 2. Avanzar fecha a 2025-06-15 (ahora está VENCIDO)
    _mock_hoy(monkeypatch, date(2025, 6, 15))
    recalcular_notificaciones_persistidas(db_session, inmediato=True)

    notifs_vencidas = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    target_vencida = next(n for n in notifs_vencidas if n.id_notificacion == target.id_notificacion)
    assert target_vencida.nivel == "VENCIDO"
    # Debe haberse reactivado (leida == False) automáticamente
    assert target_vencida.leida is False


def test_marcar_todas_notificaciones_leidas(db_session, monkeypatch):
    from src.notificaciones.services import marcar_todas_notificaciones_leidas

    _mock_hoy(monkeypatch, date(2025, 6, 10))
    u1 = _personal_admin(db_session, dni="55555555", email="u5@test.com")

    e1 = ElementoLimpieza(nombre="E1", frecuencia_recambio_dias=1, fecha_ultimo_recambio=date(2025, 6, 1), activo=True)
    e2 = ElementoLimpieza(nombre="E2", frecuencia_recambio_dias=1, fecha_ultimo_recambio=date(2025, 6, 1), activo=True)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(e1)
        db_session.add(e2)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    recalcular_notificaciones_persistidas(db_session, inmediato=True)
    marcadas = marcar_todas_notificaciones_leidas(db_session, usuario_id=u1.id)
    assert marcadas >= 2

    notifs = obtener_todas_notificaciones(db_session, usuario_id=u1.id)
    assert len(notifs) >= 2
    assert all(n.leida is True for n in notifs)

