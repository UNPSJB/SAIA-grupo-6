"""Tests unitarios de services del módulo `sector`.

Anatomía de cada test: Arrange → Act → Assert, con comentarios `# Act:` y
`# Assert:`. Cada test importa explícitamente los fixtures que usa desde
`tests.database`.
"""

from sqlalchemy import select

from src.exceptions import ConflictoRegistroInactivo
from src.sector import exceptions, schemas
from src.sector.models import Sector
from src.sector.services import (
    crear_sector,
    eliminar_sector,
    listar_sectores,
    listar_sectores_paginado,
    obtener_sector,
    actualizar_sector,
)
from tests.database import db_session


# ---------------------------------------------------------------------------
# Fixtures de datos (sector)
# ---------------------------------------------------------------------------

def _sector_activo(db, nombre="Limpieza", descripcion="Sector de limpieza"):
    fila = Sector(nombre=nombre, descripcion=descripcion, activo=True)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _sector_inactivo(db, nombre="Inactivo", descripcion="Dado de baja"):
    fila = Sector(nombre=nombre, descripcion=descripcion, activo=False)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# crear_sector
# ---------------------------------------------------------------------------

def test_crear_sector_caso_feliz(db_session):
    # Arrange
    datos = schemas.SectorCreate(nombre="Cocina", descripcion="Area de cocina")

    # Act
    creado = crear_sector(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Cocina"
    assert creado.descripcion == "Area de cocina"
    assert creado.activo is True


def test_crear_sector_con_nombre_duplicado_activo_lanza_sector_ya_existe(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Cocina")
    datos = schemas.SectorCreate(nombre="Cocina")

    # Act / Assert
    try:
        crear_sector(db_session, datos)
    except exceptions.SectorYaExiste as e:
        assert e.status_code == 400
        assert e.detail == "Ya existe un sector registrado con ese nombre."
    else:
        raise AssertionError("Se esperaba SectorYaExiste")


def test_crear_sector_con_nombre_duplicado_inactivo_lanza_conflicto_registro_inactivo(db_session):
    # Arrange
    inactivo = _sector_inactivo(db_session, nombre="Cocina")
    datos = schemas.SectorCreate(nombre="Cocina")

    # Act / Assert
    try:
        crear_sector(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "nombre"
        assert e.detail["tipo"] == "inactivo"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_sector_nombre_en_limite_maximo(db_session):
    # Arrange (String(60))
    nombre_largo = "A" * 60
    datos = schemas.SectorCreate(nombre=nombre_largo)

    # Act
    creado = crear_sector(db_session, datos)

    # Assert
    assert creado.nombre == nombre_largo


# ---------------------------------------------------------------------------
# listar_sectores
# ---------------------------------------------------------------------------

def test_listar_sectores_vacio(db_session):
    # Arrange (ninguna fila)

    # Act
    resultado = listar_sectores(db_session)

    # Assert
    assert resultado == []


def test_listar_sectores_solo_activos_por_defecto(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Activo 1")
    _sector_inactivo(db_session, nombre="Inactivo 1")

    # Act
    resultado = listar_sectores(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activo 1"


def test_listar_sectores_incluyendo_inactivos(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Activo 1")
    _sector_inactivo(db_session, nombre="Inactivo 1")

    # Act
    resultado = listar_sectores(db_session, incluir_inactivos=True)

    # Assert
    assert len(resultado) == 2


def test_listar_sectores_buscar_ignora_tildes_y_mayusculas(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Área Limpieza", descripcion="Zona")

    # Act
    resultado = listar_sectores(db_session, buscar="area")

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Área Limpieza"


def test_listar_sectores_buscar_por_descripcion(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Limpieza", descripcion="Zona de oficina")

    # Act
    resultado = listar_sectores(db_session, buscar="oficina")

    # Assert
    assert len(resultado) == 1


def test_listar_sectores_buscar_sin_resultados(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Limpieza")

    # Act
    resultado = listar_sectores(db_session, buscar="inexistente")

    # Assert
    assert resultado == []


# ---------------------------------------------------------------------------
# listar_sectores_paginado
# ---------------------------------------------------------------------------

def test_listar_sectores_paginado_vacio(db_session):
    # Arrange

    # Act
    items, total = listar_sectores_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10
    )

    # Assert
    assert items == []
    assert total == 0


def test_listar_sectores_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        _sector_activo(db_session, nombre=f"Sector {i}")

    # Act
    items, total = listar_sectores_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_sectores_paginado_segunda_pagina(db_session):
    # Arrange
    for i in range(5):
        _sector_activo(db_session, nombre=f"Sector {i}")

    # Act
    items, total = listar_sectores_paginado(
        db_session, incluir_inactivos=False, page=3, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 1


def test_listar_sectores_paginado_orden_nombre_desc(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Alfa")
    _sector_activo(db_session, nombre="Beta")

    # Act
    items, _ = listar_sectores_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="nombre_desc"
    )

    # Assert
    assert [s.nombre for s in items] == ["Beta", "Alfa"]


def test_listar_sectores_paginado_buscar_filtra(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Limpieza", descripcion="Zona de limpieza")
    _sector_activo(db_session, nombre="Cocina", descripcion="Zona de cocina")

    # Act
    items, total = listar_sectores_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, buscar="Limp"
    )

    # Assert
    assert total == 1
    assert items[0].nombre == "Limpieza"


def test_listar_sectores_paginado_incluir_inactivos(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Activo")
    _sector_inactivo(db_session, nombre="Inactivo")

    # Act
    items, total = listar_sectores_paginado(
        db_session, incluir_inactivos=True, page=1, page_size=10
    )

    # Assert
    assert total == 2


# ---------------------------------------------------------------------------
# obtener_sector
# ---------------------------------------------------------------------------

def test_obtener_sector_existe(db_session):
    # Arrange
    creado = _sector_activo(db_session, nombre="Limpieza")

    # Act
    obtenido = obtener_sector(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id
    assert obtenido.nombre == "Limpieza"


def test_obtener_sector_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_sector(db_session, 9999)
    except exceptions.SectorNoEncontrado as e:
        assert e.status_code == 404
    else:
        raise AssertionError("Se esperaba SectorNoEncontrado")


def test_obtener_sector_dado_de_baja(db_session):
    # Arrange
    inactivo = _sector_inactivo(db_session, nombre="Baja")

    # Act (obtener_sector no filtra por activo, solo por id)
    obtenido = obtener_sector(db_session, inactivo.id)

    # Assert
    assert obtenido.id == inactivo.id
    assert obtenido.activo is False


# ---------------------------------------------------------------------------
# actualizar_sector
# ---------------------------------------------------------------------------

def test_actualizar_sector_parcial_exclude_unset(db_session):
    # Arrange
    creado = _sector_activo(db_session, nombre="Limpieza", descripcion="Vieja")
    datos = schemas.SectorUpdate(descripcion="Nueva")  # solo descripcion

    # Act
    actualizado = actualizar_sector(db_session, creado.id, datos)

    # Assert
    assert actualizado.nombre == "Limpieza"  # no cambió
    assert actualizado.descripcion == "Nueva"


def test_actualizar_sector_conflicto_unicidad(db_session):
    # Arrange
    _sector_activo(db_session, nombre="Limpieza")
    otro = _sector_activo(db_session, nombre="Cocina")
    datos = schemas.SectorUpdate(nombre="Limpieza")

    # Act / Assert
    try:
        actualizar_sector(db_session, otro.id, datos)
    except exceptions.SectorYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba SectorYaExiste")


def test_actualizar_sector_no_existe(db_session):
    # Arrange
    datos = schemas.SectorUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_sector(db_session, 9999, datos)
    except exceptions.SectorNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba SectorNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_sector (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_sector_pasa_a_activo_falso(db_session):
    # Arrange
    creado = _sector_activo(db_session, nombre="Limpieza")

    # Act
    eliminado = eliminar_sector(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


def test_eliminar_sector_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_sector(db_session, 9999)
    except exceptions.SectorNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba SectorNoEncontrado")


def test_eliminar_sector_en_uso_por_equipo_activo_lanza_sector_en_uso(db_session):
    # Arrange
    sector = _sector_activo(db_session, nombre="Limpieza")
    from src.Equipo.models import Equipo

    equipo = Equipo(
        nombre="Aspiradora",
        tipo="Electrico",
        sector_id=sector.id,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(equipo)
        db_session.commit()
        db_session.refresh(equipo)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        eliminar_sector(db_session, sector.id)
    except exceptions.SectorEnUso:
        pass
    else:
        raise AssertionError("Se esperaba SectorEnUso")


def test_eliminar_sector_equipo_inactivo_no_bloquea(db_session):
    # Arrange
    sector = _sector_activo(db_session, nombre="Limpieza")
    from src.Equipo.models import Equipo

    equipo = Equipo(
        nombre="Aspiradora",
        tipo="Electrico",
        sector_id=sector.id,
        activo=False,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(equipo)
        db_session.commit()
        db_session.refresh(equipo)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    eliminado = eliminar_sector(db_session, sector.id)

    # Assert
    assert eliminado.activo is False
