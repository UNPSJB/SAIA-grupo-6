"""Tests unitarios de services del módulo `proveedores`."""

from src.exceptions import ConflictoRegistroInactivo
from src.proveedores import exceptions, schemas
from src.proveedores.models import Proveedor
from src.proveedores.services import (
    crear_proveedor,
    eliminar_proveedor,
    listar_proveedores,
    obtener_proveedor,
    actualizar_proveedor,
)
from tests.database import db_session


def _proveedor(db, nombre="Proveedor A", matricula="MAT-001", activo=True):
    fila = Proveedor(nombre=nombre, matricula=matricula, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# crear_proveedor
# ---------------------------------------------------------------------------

def test_crear_proveedor_caso_feliz(db_session):
    # Arrange
    datos = schemas.ProveedorCreate(nombre="Proveedor A", matricula="MAT-001")

    # Act
    creado = crear_proveedor(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Proveedor A"
    assert creado.matricula == "MAT-001"
    assert creado.activo is True


def test_crear_proveedor_matricula_duplicada_activa_lanza_matricula_ya_existe(db_session):
    # Arrange
    _proveedor(db_session, nombre="Proveedor A", matricula="MAT-001")
    datos = schemas.ProveedorCreate(nombre="Proveedor B", matricula="MAT-001")

    # Act / Assert
    try:
        crear_proveedor(db_session, datos)
    except exceptions.MatriculaYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba MatriculaYaExiste")


def test_crear_proveedor_matricula_duplicada_inactiva_lanza_conflicto(db_session):
    # Arrange
    inactivo = _proveedor(db_session, nombre="Proveedor A", matricula="MAT-001", activo=False)
    datos = schemas.ProveedorCreate(nombre="Proveedor B", matricula="MAT-001")

    # Act / Assert
    try:
        crear_proveedor(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "matricula"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


# ---------------------------------------------------------------------------
# listar_proveedores
# ---------------------------------------------------------------------------

def test_listar_proveedores_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_proveedores(db_session)

    # Assert
    assert resultado == []


def test_listar_proveedores_solo_activos_por_defecto(db_session):
    # Arrange
    _proveedor(db_session, nombre="Activo", matricula="MAT-001")
    _proveedor(db_session, nombre="Inactivo", matricula="MAT-002", activo=False)

    # Act
    resultado = listar_proveedores(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activo"


def test_listar_proveedores_incluyendo_inactivos(db_session):
    # Arrange
    _proveedor(db_session, nombre="Activo", matricula="MAT-001")
    _proveedor(db_session, nombre="Inactivo", matricula="MAT-002", activo=False)

    # Act
    resultado = listar_proveedores(db_session, incluir_inactivos=True)

    # Assert
    assert len(resultado) == 2


def test_listar_proveedores_buscar_por_nombre_o_matricula(db_session):
    # Arrange
    _proveedor(db_session, nombre="Limpieza SA", matricula="MAT-001")

    # Act
    resultado = listar_proveedores(db_session, buscar="Limpieza")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# obtener_proveedor
# ---------------------------------------------------------------------------

def test_obtener_proveedor_existe(db_session):
    # Arrange
    creado = _proveedor(db_session, nombre="Proveedor A", matricula="MAT-001")

    # Act
    obtenido = obtener_proveedor(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_proveedor_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_proveedor(db_session, 9999)
    except exceptions.ProveedorNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ProveedorNoEncontrado")


# ---------------------------------------------------------------------------
# actualizar_proveedor
# ---------------------------------------------------------------------------

def test_actualizar_proveedor_parcial(db_session):
    # Arrange
    creado = _proveedor(db_session, nombre="Proveedor A", matricula="MAT-001")
    datos = schemas.ProveedorUpdate(matricula="MAT-002")

    # Act
    actualizado = actualizar_proveedor(db_session, creado.id, datos)

    # Assert
    assert actualizado.nombre == "Proveedor A"
    assert actualizado.matricula == "MAT-002"


def test_actualizar_proveedor_conflicto_matricula(db_session):
    # Arrange
    _proveedor(db_session, nombre="A", matricula="MAT-001")
    otro = _proveedor(db_session, nombre="B", matricula="MAT-002")
    datos = schemas.ProveedorUpdate(matricula="MAT-001")

    # Act / Assert
    try:
        actualizar_proveedor(db_session, otro.id, datos)
    except exceptions.MatriculaYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba MatriculaYaExiste")


def test_actualizar_proveedor_no_existe(db_session):
    # Arrange
    datos = schemas.ProveedorUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_proveedor(db_session, 9999, datos)
    except exceptions.ProveedorNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ProveedorNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_proveedor (baja lógica directa)
# ---------------------------------------------------------------------------

def test_eliminar_proveedor_pasa_a_activo_falso(db_session):
    # Arrange
    creado = _proveedor(db_session, nombre="Proveedor A", matricula="MAT-001")

    # Act
    eliminado = eliminar_proveedor(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


def test_eliminar_proveedor_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_proveedor(db_session, 9999)
    except exceptions.ProveedorNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ProveedorNoEncontrado")
