"""Tests unitarios de services del módulo `Equipo`."""

import pytest

from src.sector.models import Sector
from src.Equipo import exceptions, schemas
from src.Equipo.models import Equipo
from src.Equipo.services import (
    actualizar_equipo,
    crear_equipo,
    dar_de_baja_equipo,
    listar_equipos,
    listar_equipos_paginado,
    obtener_equipo,
    obtener_opciones_equipos,
)
from tests.database import db_session


def _sector(db, nombre="Sector A", activo=True):
    fila = Sector(nombre=nombre, descripcion="d", activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _equipo(db, nombre="Aspiradora", tipo="Electrico", sector_id=1, activo=True, frecuencia=None):
    fila = Equipo(
        nombre=nombre, tipo=tipo, sector_id=sector_id,
        activo=activo, frecuencia_calibracion_dias=frecuencia,
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
# crear_equipo
# ---------------------------------------------------------------------------

def test_crear_equipo_caso_feliz(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    datos = schemas.EquipoCreate(
        nombre="Aspiradora", sector_id=sector.id, tipo="Electrico",
        frecuencia_calibracion_dias=365,
    )

    # Act
    creado = crear_equipo(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Aspiradora"
    assert creado.sector_id == sector.id
    assert creado.activo is True


def test_crear_equipo_sector_inactivo_lanza_sector_invalido(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Inactivo", activo=False)
    datos = schemas.EquipoCreate(
        nombre="Aspiradora", sector_id=sector.id, tipo="Electrico",
    )

    # Act / Assert
    try:
        crear_equipo(db_session, datos)
    except exceptions.SectorInvalido:
        pass
    else:
        raise AssertionError("Se esperaba SectorInvalido")


def test_crear_equipo_sector_inexistente_lanza_sector_invalido(db_session):
    # Arrange
    datos = schemas.EquipoCreate(
        nombre="Aspiradora", sector_id=9999, tipo="Electrico",
    )

    # Act / Assert
    try:
        crear_equipo(db_session, datos)
    except exceptions.SectorInvalido:
        pass
    else:
        raise AssertionError("Se esperaba SectorInvalido")


def test_crear_equipo_nombre_duplicado_activo_lanza_nombre_duplicado(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    _equipo(db_session, nombre="Aspiradora", sector_id=sector.id, tipo="Electrico")
    datos = schemas.EquipoCreate(
        nombre="Aspiradora", sector_id=sector.id, tipo="Mecanico",
    )

    # Act / Assert
    try:
        crear_equipo(db_session, datos)
    except exceptions.NombreDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba NombreDuplicado")


# ---------------------------------------------------------------------------
# listar_equipos
# ---------------------------------------------------------------------------

def test_listar_equipos_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_equipos(db_session)

    # Assert
    assert resultado == []


def test_listar_equipos_solo_activos_por_defecto(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    _equipo(db_session, nombre="Activo", sector_id=sector.id, tipo="E")
    _equipo(db_session, nombre="Inactivo", sector_id=sector.id, tipo="E", activo=False)

    # Act
    resultado = listar_equipos(db_session)

    # Assert
    assert len(resultado) == 1


def test_listar_equipos_filtro_por_tipo(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    _equipo(db_session, nombre="A", sector_id=sector.id, tipo="Electrico")
    _equipo(db_session, nombre="B", sector_id=sector.id, tipo="Mecanico")

    # Act
    resultado = listar_equipos(db_session, tipo="Electrico")

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == "Electrico"


def test_listar_equipos_filtro_por_sector(db_session):
    # Arrange
    s1 = _sector(db_session, nombre="S1")
    s2 = _sector(db_session, nombre="S2")
    _equipo(db_session, nombre="A", sector_id=s1.id, tipo="E")
    _equipo(db_session, nombre="B", sector_id=s2.id, tipo="E")

    # Act
    resultado = listar_equipos(db_session, sector_id=s1.id)

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_equipos_paginado
# ---------------------------------------------------------------------------

def test_listar_equipos_paginado_page_y_page_size(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    for i in range(5):
        _equipo(db_session, nombre=f"E{i}", sector_id=sector.id, tipo="T")

    # Act
    items, total = listar_equipos_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# obtener_opciones_equipos
# ---------------------------------------------------------------------------

def test_obtener_opciones_equipos_tipos_y_sectores(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    _equipo(db_session, nombre="A", sector_id=sector.id, tipo="Electrico")
    _equipo(db_session, nombre="B", sector_id=sector.id, tipo="Mecanico")

    # Act
    opciones = obtener_opciones_equipos(db_session)

    # Assert
    assert "Electrico" in opciones.tipos
    assert "Mecanico" in opciones.tipos
    assert len(opciones.sectores) == 1


# ---------------------------------------------------------------------------
# obtener_equipo
# ---------------------------------------------------------------------------

def test_obtener_equipo_existe(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    creado = _equipo(db_session, nombre="Aspiradora", sector_id=sector.id)

    # Act
    obtenido = obtener_equipo(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_equipo_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_equipo(db_session, 9999)
    except exceptions.EquipoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba EquipoNoEncontrado")


# ---------------------------------------------------------------------------
# actualizar_equipo
# ---------------------------------------------------------------------------

def test_actualizar_equipo_parcial(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    sector2 = _sector(db_session, nombre="Cocina")
    creado = _equipo(db_session, nombre="Aspiradora", sector_id=sector.id)
    datos = schemas.EquipoUpdate(tipo="Mecanico")

    # Act
    actualizado = actualizar_equipo(db_session, creado.id, datos)

    # Assert
    assert actualizado.tipo == "Mecanico"
    assert actualizado.sector_id == sector.id


def test_actualizar_equipo_sector_inactivo_lanza_sector_invalido(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    sector_inactivo = _sector(db_session, nombre="Inactivo", activo=False)
    creado = _equipo(db_session, nombre="Aspiradora", sector_id=sector.id)
    datos = schemas.EquipoUpdate(sector_id=sector_inactivo.id)

    # Act / Assert
    try:
        actualizar_equipo(db_session, creado.id, datos)
    except exceptions.SectorInvalido:
        pass
    else:
        raise AssertionError("Se esperaba SectorInvalido")


def test_actualizar_equipo_no_existe(db_session):
    # Arrange
    datos = schemas.EquipoUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_equipo(db_session, 9999, datos)
    except exceptions.EquipoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba EquipoNoEncontrado")


# ---------------------------------------------------------------------------
# dar_de_baja_equipo (baja lógica)
# ---------------------------------------------------------------------------

def test_dar_de_baja_equipo_pasa_a_activo_falso(db_session):
    # Arrange
    sector = _sector(db_session, nombre="Limpieza")
    creado = _equipo(db_session, nombre="Aspiradora", sector_id=sector.id)

    # Act
    dado_de_baja = dar_de_baja_equipo(db_session, creado.id)

    # Assert
    assert dado_de_baja.activo is False


def test_dar_de_baja_equipo_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        dar_de_baja_equipo(db_session, 9999)
    except exceptions.EquipoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba EquipoNoEncontrado")
