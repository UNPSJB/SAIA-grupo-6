"""Tests unitarios de services del módulo `vencimientoPersonal`."""

from datetime import date

from src.aptitud.models import Aptitud
from src.personal.models import Personal
from src.vencimientoPersonal import exceptions, schemas
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vencimientoPersonal.services import (
    actualizar_vencimiento,
    crear_vencimiento,
    eliminar_vencimiento,
    listar_vencimientos_de_persona,
    obtener_vencimiento,
)
from tests.database import db_session


def _personal(db, dni="12345678", email="juan@test.com", activo=True):
    fila = Personal(
        nombre="Juan", apellido="Perez", dni=dni, email=email,
        password="hash", puede_operar=True, activo=activo,
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


def _vencimiento(db, persona_id, aptitud_id, fecha=date(2025, 12, 31), activo=True):
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


# ---------------------------------------------------------------------------
# crear_vencimiento
# ---------------------------------------------------------------------------

def test_crear_vencimiento_caso_feliz(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 12, 31),
    )

    # Act
    creado = crear_vencimiento(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.persona_id == persona.id
    assert creado.aptitud_id == aptitud.id
    assert creado.activo is True


def test_crear_vencimiento_persona_inexistente_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    aptitud = _aptitud(db_session)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=9999, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 12, 31),
    )

    # Act / Assert
    try:
        crear_vencimiento(db_session, datos)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


def test_crear_vencimiento_aptitud_inexistente_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=9999,
        fecha_vencimiento=date(2025, 12, 31),
    )

    # Act / Assert
    try:
        crear_vencimiento(db_session, datos)
    except exceptions.AptitudNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudNoEncontrada")


def test_crear_vencimiento_persona_inactiva_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session, activo=False)
    aptitud = _aptitud(db_session)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 12, 31),
    )

    # Act / Assert
    try:
        crear_vencimiento(db_session, datos)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


def test_crear_vencimiento_aptitud_inactiva_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session, activo=False)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 12, 31),
    )

    # Act / Assert
    try:
        crear_vencimiento(db_session, datos)
    except exceptions.AptitudNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudNoEncontrada")


def test_crear_vencimiento_duplicado_activo_lanza_aptitud_duplicada(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    _vencimiento(db_session, persona.id, aptitud.id, fecha=date(2025, 12, 31), activo=True)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2026, 12, 31),
    )

    # Act / Assert
    try:
        crear_vencimiento(db_session, datos)
    except exceptions.AptitudDuplicada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudDuplicada")


def test_crear_vencimiento_duplicado_inactivo_reactiva(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    existente = _vencimiento(db_session, persona.id, aptitud.id, fecha=date(2025, 6, 1), activo=False)
    datos = schemas.VencimientoPersonalCreate(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2026, 12, 31),
    )

    # Act
    creado = crear_vencimiento(db_session, datos)

    # Assert
    assert creado.id == existente.id
    assert creado.activo is True
    assert creado.fecha_vencimiento == date(2026, 12, 31)


# ---------------------------------------------------------------------------
# listar_vencimientos_de_persona
# ---------------------------------------------------------------------------

def test_listar_vencimientos_de_persona_vacio(db_session):
    # Arrange
    persona = _personal(db_session)

    # Act
    resultado = listar_vencimientos_de_persona(db_session, persona.id)

    # Assert
    assert resultado == []


def test_listar_vencimientos_de_persona_solo_activos(db_session):
    # Arrange
    persona = _personal(db_session)
    aptitud1 = _aptitud(db_session, nombre="Altura")
    aptitud2 = _aptitud(db_session, nombre="Electro")
    _vencimiento(db_session, persona.id, aptitud1.id, activo=True)
    _vencimiento(db_session, persona.id, aptitud2.id, activo=False)

    # Act
    resultado = listar_vencimientos_de_persona(db_session, persona.id)

    # Assert
    assert len(resultado) == 1


def test_listar_vencimientos_de_persona_persona_inexistente(db_session):
    # Arrange

    # Act / Assert
    try:
        listar_vencimientos_de_persona(db_session, 9999)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


# ---------------------------------------------------------------------------
# obtener_vencimiento
# ---------------------------------------------------------------------------

def test_obtener_vencimiento_existe(db_session):
    # Arrange
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    creado = _vencimiento(db_session, persona.id, aptitud.id)

    # Act
    obtenido = obtener_vencimiento(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_vencimiento_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_vencimiento(db_session, 9999)
    except exceptions.VencimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba VencimientoNoEncontrado")


# ---------------------------------------------------------------------------
# actualizar_vencimiento (fecha no puede ser pasada -> monkeypatch)
# ---------------------------------------------------------------------------

def test_actualizar_vencimiento_fecha_valida(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    creado = _vencimiento(db_session, persona.id, aptitud.id, fecha=date(2025, 6, 1))
    datos = schemas.VencimientoPersonalUpdate(fecha_vencimiento=date(2025, 12, 31))

    # Act
    actualizado = actualizar_vencimiento(db_session, creado.id, datos)

    # Assert
    assert actualizado.fecha_vencimiento == date(2025, 12, 31)


def test_actualizar_vencimiento_fecha_pasada_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    creado = _vencimiento(db_session, persona.id, aptitud.id, fecha=date(2025, 12, 31))
    # Act / Assert
    try:
        datos = schemas.VencimientoPersonalUpdate(fecha_vencimiento=date(2024, 12, 31))
        actualizar_vencimiento(db_session, creado.id, datos)
    except exceptions.FechaVencimientoPasada:
        pass
    else:
        raise AssertionError("Se esperaba FechaVencimientoPasada")


def test_actualizar_vencimiento_no_existe(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr("src.vencimientoPersonal.schemas.hoy", lambda: date(2025, 1, 1))

    # Act / Assert
    try:
        datos = schemas.VencimientoPersonalUpdate(fecha_vencimiento=date(2027, 12, 31))
        actualizar_vencimiento(db_session, 9999, datos)
    except exceptions.VencimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba VencimientoNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_vencimiento (baja lógica, retorna None)
# ---------------------------------------------------------------------------

def test_eliminar_vencimiento_pasa_a_activo_falso(db_session):
    # Arrange
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    creado = _vencimiento(db_session, persona.id, aptitud.id)

    # Act
    resultado = eliminar_vencimiento(db_session, creado.id)

    # Assert
    assert resultado is None
    vencimiento = db_session.get(VencimientoPersonal, creado.id)
    assert vencimiento.activo is False


def test_eliminar_vencimiento_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_vencimiento(db_session, 9999)
    except exceptions.VencimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba VencimientoNoEncontrado")
