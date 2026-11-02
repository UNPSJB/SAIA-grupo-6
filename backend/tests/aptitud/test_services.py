"""Tests unitarios de services del módulo `aptitud`."""

from datetime import date

from sqlalchemy import select

from src.exceptions import ConflictoRegistroInactivo
from src.aptitud import exceptions, schemas
from src.aptitud.models import Aptitud
from src.aptitud.services import (
    crear_aptitud,
    eliminar_aptitud,
    listar_aptitudes,
    listar_aptitudes_paginado,
    obtener_aptitud,
    actualizar_aptitud,
)
from src.personal.models import Personal
from src.vencimientoPersonal.models import VencimientoPersonal
from tests.database import db_session


def _aptitud(db, nombre="Altura", descripcion="Trabajo en altura", activo=True):
    fila = Aptitud(nombre=nombre, descripcion=descripcion, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _personal(db, nombre="Juan", apellido="Perez", dni="12345678", email="juan@test.com"):
    fila = Personal(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        email=email,
        password="hasheado",
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
# crear_aptitud
# ---------------------------------------------------------------------------

def test_crear_aptitud_caso_feliz(db_session):
    # Arrange
    datos = schemas.AptitudCreate(nombre="altura", descripcion="Trabajo en altura")

    # Act
    creada = crear_aptitud(db_session, datos)

    # Assert
    assert creada.id is not None
    assert creada.nombre == "altura"
    assert creada.activo is True


def test_crear_aptitud_nombre_duplicado_activo_lanza_ya_existe(db_session):
    # Arrange
    _aptitud(db_session, nombre="Altura")
    datos = schemas.AptitudCreate(nombre="Altura")

    # Act / Assert
    try:
        crear_aptitud(db_session, datos)
    except exceptions.AptitudYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba AptitudYaExiste")


def test_crear_aptitud_nombre_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    inactivo = _aptitud(db_session, nombre="Altura", activo=False)
    datos = schemas.AptitudCreate(nombre="Altura")

    # Act / Assert
    try:
        crear_aptitud(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "nombre"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_aptitud_nombre_en_limite_maximo(db_session):
    # Arrange (String(60))
    nombre = "A" * 60
    datos = schemas.AptitudCreate(nombre=nombre)

    # Act
    creada = crear_aptitud(db_session, datos)

    # Assert
    assert creada.nombre == nombre


# ---------------------------------------------------------------------------
# listar_aptitudes
# ---------------------------------------------------------------------------

def test_listar_aptitudes_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_aptitudes(db_session)

    # Assert
    assert resultado == []


def test_listar_aptitudes_solo_activos_por_defecto(db_session):
    # Arrange
    _aptitud(db_session, nombre="Activa")
    _aptitud(db_session, nombre="Inactiva", activo=False)

    # Act
    resultado = listar_aptitudes(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activa"


def test_listar_aptitudes_incluyendo_inactivos(db_session):
    # Arrange
    _aptitud(db_session, nombre="Activa")
    _aptitud(db_session, nombre="Inactiva", activo=False)

    # Act
    resultado = listar_aptitudes(db_session, incluir_inactivos=True)

    # Assert
    assert len(resultado) == 2


def test_listar_aptitudes_buscar_ignora_tildes(db_session):
    # Arrange
    _aptitud(db_session, nombre="Capacitación", descripcion="Curso")

    # Act
    resultado = listar_aptitudes(db_session, buscar="capacitacion")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_aptitudes_paginado
# ---------------------------------------------------------------------------

def test_listar_aptitudes_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        _aptitud(db_session, nombre=f"Aptitud {i}")

    # Act
    items, total = listar_aptitudes_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_aptitudes_paginado_orden_nombre_desc(db_session):
    # Arrange
    _aptitud(db_session, nombre="Alfa")
    _aptitud(db_session, nombre="Beta")

    # Act
    items, _ = listar_aptitudes_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="nombre_desc"
    )

    # Assert
    assert [a.nombre for a in items] == ["Beta", "Alfa"]


# ---------------------------------------------------------------------------
# obtener_aptitud
# ---------------------------------------------------------------------------

def test_obtener_aptitud_existe(db_session):
    # Arrange
    creada = _aptitud(db_session, nombre="Altura")

    # Act
    obtenida = obtener_aptitud(db_session, creada.id)

    # Assert
    assert obtenida.id == creada.id


def test_obtener_aptitud_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_aptitud(db_session, 9999)
    except exceptions.AptitudNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudNoEncontrada")


# ---------------------------------------------------------------------------
# actualizar_aptitud
# ---------------------------------------------------------------------------

def test_actualizar_aptitud_parcial(db_session):
    # Arrange
    creada = _aptitud(db_session, nombre="Altura", descripcion="Vieja")
    datos = schemas.AptitudUpdate(descripcion="Nueva")

    # Act
    actualizada = actualizar_aptitud(db_session, creada.id, datos)

    # Assert
    assert actualizada.nombre == "Altura"
    assert actualizada.descripcion == "Nueva"


def test_actualizar_aptitud_conflicto_nombre(db_session):
    # Arrange
    _aptitud(db_session, nombre="Altura")
    otro = _aptitud(db_session, nombre="Otra")
    datos = schemas.AptitudUpdate(nombre="Altura")

    # Act / Assert
    try:
        actualizar_aptitud(db_session, otro.id, datos)
    except exceptions.AptitudYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba AptitudYaExiste")


def test_actualizar_aptitud_no_existe(db_session):
    # Arrange
    datos = schemas.AptitudUpdate(nombre="Otra")

    # Act / Assert
    try:
        actualizar_aptitud(db_session, 9999, datos)
    except exceptions.AptitudNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudNoEncontrada")


# ---------------------------------------------------------------------------
# eliminar_aptitud (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_aptitud_pasa_a_activo_falso(db_session):
    # Arrange
    creada = _aptitud(db_session, nombre="Altura")

    # Act
    eliminada = eliminar_aptitud(db_session, creada.id)

    # Assert
    assert eliminada.activo is False


def test_eliminar_aptitud_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_aptitud(db_session, 9999)
    except exceptions.AptitudNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba AptitudNoEncontrada")


def test_eliminar_aptitud_en_uso_por_vencimiento_activo_lanza_en_uso(db_session):
    # Arrange
    aptitud = _aptitud(db_session, nombre="Altura")
    persona = _personal(db_session, dni="12345678", email="juan@test.com")
    vp = VencimientoPersonal(
        persona_id=persona.id,
        aptitud_id=aptitud.id,
        fecha_vencimiento=date(2024, 12, 31),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
        db_session.refresh(vp)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        eliminar_aptitud(db_session, aptitud.id)
    except exceptions.AptitudEnUso:
        pass
    else:
        raise AssertionError("Se esperaba AptitudEnUso")


def test_eliminar_aptitud_vencimiento_inactivo_no_bloquea(db_session):
    # Arrange
    aptitud = _aptitud(db_session, nombre="Altura")
    persona = _personal(db_session, dni="87654321", email="ana@test.com")
    vp = VencimientoPersonal(
        persona_id=persona.id,
        aptitud_id=aptitud.id,
        fecha_vencimiento=date(2024, 12, 31),
        activo=False,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
        db_session.refresh(vp)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    eliminada = eliminar_aptitud(db_session, aptitud.id)

    # Assert
    assert eliminada.activo is False
