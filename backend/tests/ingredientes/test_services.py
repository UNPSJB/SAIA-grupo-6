"""Tests unitarios de services del módulo `ingredientes`."""

from sqlalchemy import select

from src.exceptions import ConflictoRegistroInactivo
from src.ingredientes import exceptions, schemas
from src.ingredientes.models import Ingrediente
from src.ingredientes.services import (
    crear_ingrediente,
    eliminar_ingrediente,
    listar_ingredientes,
    listar_ingredientes_paginado,
    leer_ingrediente,
    modificar_ingrediente,
)
from src.unidadMedida.constants import equivalencia_conocida
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


def _um(db_session, nombre="Unidad", simbolo="UN", activo=True):
    # Tipo y factor reales (Kilogramo es masa, Litro volumen): con el default
    # "unidad" el alta del ingrediente exigiría peso unitario.
    fila = UnidadMedida(
        nombre=nombre, simbolo=simbolo, activo=activo, **(equivalencia_conocida(nombre, simbolo) or {})
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(fila)
        db_session.commit()
        db_session.refresh(fila)
    finally:
        db_session.info.pop("sin_auditoria", None)
    return fila


def _ingrediente(db_session, nombre="Ingrediente A", um_id=1, activo=True):
    fila = Ingrediente(nombre=nombre, unidad_medida_id=um_id, activo=activo)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(fila)
        db_session.commit()
        db_session.refresh(fila)
    finally:
        db_session.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# crear_ingrediente
# ---------------------------------------------------------------------------

def test_crear_ingrediente_caso_feliz(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    datos = schemas.IngredienteCreate(nombre="Harina", unidad_medida_id=unidad.id)

    # Act
    creado = crear_ingrediente(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Harina"
    assert creado.unidad_medida_id == unidad.id
    assert creado.activo is True


def test_crear_ingrediente_nombre_duplicado_activo_lanza_ya_existe(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    _ingrediente(db_session, nombre="Harina", um_id=unidad.id)
    datos = schemas.IngredienteCreate(nombre="Harina", unidad_medida_id=unidad.id)

    # Act / Assert
    try:
        crear_ingrediente(db_session, datos)
    except exceptions.IngredienteYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba IngredienteYaExiste")


def test_crear_ingrediente_nombre_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    inactivo = _ingrediente(db_session, nombre="Harina", um_id=unidad.id, activo=False)
    datos = schemas.IngredienteCreate(nombre="Harina", unidad_medida_id=unidad.id)

    # Act / Assert
    try:
        crear_ingrediente(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "nombre"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_ingrediente_unidad_medida_inexistente_lanza_error(db_session):
    # Arrange
    datos = schemas.IngredienteCreate(nombre="Harina", unidad_medida_id=9999)

    # Act / Assert
    try:
        crear_ingrediente(db_session, datos)
    except exceptions.UnidadMedidaNoExiste:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaNoExiste")


def test_crear_ingrediente_unidad_medida_inactiva_lanza_error(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG", activo=False)
    datos = schemas.IngredienteCreate(nombre="Harina", unidad_medida_id=unidad.id)

    # Act / Assert
    try:
        crear_ingrediente(db_session, datos)
    except exceptions.UnidadMedidaInactiva:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaInactiva")


def test_crear_ingrediente_nombre_vacio_lanza_nombre_vacio(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")

    # Act / Assert (el validador de Pydantic rechaza el nombre vacío antes del service)
    try:
        datos = schemas.IngredienteCreate(nombre="   ", unidad_medida_id=unidad.id)
        crear_ingrediente(db_session, datos)
    except Exception:
        pass
    else:
        raise AssertionError("Se esperaba una excepción por nombre vacío")


# ---------------------------------------------------------------------------
# listar_ingredientes
# ---------------------------------------------------------------------------

def test_listar_ingredientes_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_ingredientes(db_session)

    # Assert
    assert resultado == []


def test_listar_ingredientes_solo_activos_por_defecto(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    _ingrediente(db_session, nombre="Activo", um_id=unidad.id)
    _ingrediente(db_session, nombre="Inactivo", um_id=unidad.id, activo=False)

    # Act
    resultado = listar_ingredientes(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activo"


def test_listar_ingredientes_filtro_por_unidad_medida(db_session):
    # Arrange
    um1 = _um(db_session, nombre="Kilogramo", simbolo="KG")
    um2 = _um(db_session, nombre="Litro", simbolo="L")
    _ingrediente(db_session, nombre="Harina", um_id=um1.id)
    _ingrediente(db_session, nombre="Agua", um_id=um2.id)

    # Act
    resultado = listar_ingredientes(db_session, unidad_medida_id=um1.id)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Harina"


def test_listar_ingredientes_buscar_ignora_tildes(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    _ingrediente(db_session, nombre="Jab\u00f3n", um_id=unidad.id)

    # Act
    resultado = listar_ingredientes(db_session, buscar="jabon")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_ingredientes_paginado
# ---------------------------------------------------------------------------

def test_listar_ingredientes_paginado_page_y_page_size(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    for i in range(5):
        _ingrediente(db_session, nombre=f"Ingrediente {i}", um_id=unidad.id)

    # Act
    items, total = listar_ingredientes_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_ingredientes_paginado_orden_nombre_desc(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    _ingrediente(db_session, nombre="Alfa", um_id=unidad.id)
    _ingrediente(db_session, nombre="Beta", um_id=unidad.id)

    # Act
    items, _ = listar_ingredientes_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="nombre_desc"
    )

    # Assert
    assert [i.nombre for i in items] == ["Beta", "Alfa"]


# ---------------------------------------------------------------------------
# leer_ingrediente
# ---------------------------------------------------------------------------

def test_leer_ingrediente_existe(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    creado = _ingrediente(db_session, nombre="Harina", um_id=unidad.id)

    # Act
    obtenido = leer_ingrediente(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_leer_ingrediente_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_ingrediente(db_session, 9999)
    except exceptions.IngredienteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IngredienteNoEncontrado")


# ---------------------------------------------------------------------------
# modificar_ingrediente
# ---------------------------------------------------------------------------

def test_modificar_ingrediente_parcial_exclude_unset(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    otro_um = _um(db_session, nombre="Litro", simbolo="L")
    creado = _ingrediente(db_session, nombre="Harina", um_id=unidad.id)
    datos = schemas.IngredienteUpdate(nombre="Maizena")  # solo nombre

    # Act
    modificado = modificar_ingrediente(db_session, creado.id, datos)

    # Assert
    assert modificado.nombre == "Maizena"
    assert modificado.unidad_medida_id == unidad.id  # no cambi?


def test_modificar_ingrediente_cambia_unidad_medida(db_session):
    # Arrange
    um1 = _um(db_session, nombre="Kilogramo", simbolo="KG")
    um2 = _um(db_session, nombre="Litro", simbolo="L")
    creado = _ingrediente(db_session, nombre="Harina", um_id=um1.id)
    # Litro es volumen: pasar a esa unidad exige la densidad.
    datos = schemas.IngredienteUpdate(unidad_medida_id=um2.id, densidad_g_ml=0.6)

    # Act
    modificado = modificar_ingrediente(db_session, creado.id, datos)

    # Assert
    assert modificado.unidad_medida_id == um2.id


def test_modificar_ingrediente_conflicto_nombre(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    _ingrediente(db_session, nombre="Harina", um_id=unidad.id)
    otro = _ingrediente(db_session, nombre="Azucar", um_id=unidad.id)
    datos = schemas.IngredienteUpdate(nombre="Harina")

    # Act / Assert
    try:
        modificar_ingrediente(db_session, otro.id, datos)
    except exceptions.IngredienteYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba IngredienteYaExiste")


def test_modificar_ingrediente_no_existe(db_session):
    # Arrange
    datos = schemas.IngredienteUpdate(nombre="Otro")

    # Act / Assert
    try:
        modificar_ingrediente(db_session, 9999, datos)
    except exceptions.IngredienteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IngredienteNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_ingrediente (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_ingrediente_pasa_a_activo_falso(db_session):
    # Arrange
    unidad = _um(db_session, nombre="Kilogramo", simbolo="KG")
    creado = _ingrediente(db_session, nombre="Harina", um_id=unidad.id)

    # Act
    eliminado = eliminar_ingrediente(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


def test_eliminar_ingrediente_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_ingrediente(db_session, 9999)
    except exceptions.IngredienteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IngredienteNoEncontrado")
