"""Tests unitarios de services del módulo `unidadMedida`."""

from sqlalchemy import select

from src.exceptions import ConflictoRegistroInactivo
from src.insumos.models import Insumo
from src.insumoQuimico.models import InsumoQuimico, TipoQuimico
from src.unidadMedida import exceptions, schemas
from src.unidadMedida.models import UnidadMedida
from src.unidadMedida.services import (
    crear_unidad_medida,
    eliminar_unidad_medida,
    listar_unidades_medida,
    listar_unidades_medida_paginado,
    obtener_unidad_medida,
    actualizar_unidad_medida,
)
from tests.database import db_session


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
# crear_unidad_medida
# ---------------------------------------------------------------------------

def test_crear_unidad_medida_caso_feliz(db_session):
    # Arrange
    datos = schemas.UnidadMedidaCreate(nombre="Kilogramo", simbolo="kg")

    # Act
    creada = crear_unidad_medida(db_session, datos)

    # Assert
    assert creada.id is not None
    assert creada.nombre == "Kilogramo"
    assert creada.simbolo == "KG"
    assert creada.activo is True


def test_crear_unidad_medida_nombre_duplicado_activo_lanza_ya_existe(db_session):
    # Arrange
    _um(db_session, nombre="Kilogramo", simbolo="KG")
    datos = schemas.UnidadMedidaCreate(nombre="Kilogramo", simbolo="KG2")

    # Act / Assert
    try:
        crear_unidad_medida(db_session, datos)
    except exceptions.UnidadMedidaYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba UnidadMedidaYaExiste")


def test_crear_unidad_medida_simbolo_duplicado_activo_lanza_simbolo_ya_existe(db_session):
    # Arrange
    _um(db_session, nombre="Kilogramo", simbolo="KG")
    datos = schemas.UnidadMedidaCreate(nombre="Gramo", simbolo="KG")

    # Act / Assert
    try:
        crear_unidad_medida(db_session, datos)
    except exceptions.SimboloYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba SimboloYaExiste")


def test_crear_unidad_medida_nombre_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    inactivo = _um(db_session, nombre="Kilogramo", simbolo="KG", activo=False)
    datos = schemas.UnidadMedidaCreate(nombre="Kilogramo", simbolo="KG2")

    # Act / Assert
    try:
        crear_unidad_medida(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "nombre"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_unidad_medida_nombre_en_limite_maximo(db_session):
    # Arrange (String(20))
    nombre = "A" * 20
    datos = schemas.UnidadMedidaCreate(nombre=nombre, simbolo="S")

    # Act
    creada = crear_unidad_medida(db_session, datos)

    # Assert
    assert creada.nombre == nombre


def test_crear_unidad_medida_simbolo_en_limite_maximo(db_session):
    # Arrange (String(10))
    simbolo = "A" * 10
    datos = schemas.UnidadMedidaCreate(nombre="Unidad", simbolo=simbolo)

    # Act
    creada = crear_unidad_medida(db_session, datos)

    # Assert
    assert creada.simbolo == simbolo


# ---------------------------------------------------------------------------
# listar_unidades_medida
# ---------------------------------------------------------------------------

def test_listar_unidades_medida_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_unidades_medida(db_session)

    # Assert
    assert resultado == []


def test_listar_unidades_medida_solo_activos_por_defecto(db_session):
    # Arrange
    _um(db_session, nombre="Activa", simbolo="A1")
    _um(db_session, nombre="Inactiva", simbolo="I1", activo=False)

    # Act
    resultado = listar_unidades_medida(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activa"


def test_listar_unidades_medida_incluyendo_inactivos(db_session):
    # Arrange
    _um(db_session, nombre="Activa", simbolo="A1")
    _um(db_session, nombre="Inactiva", simbolo="I1", activo=False)

    # Act
    resultado = listar_unidades_medida(db_session, incluir_inactivos=True)

    # Assert
    assert len(resultado) == 2


def test_listar_unidades_medida_buscar_ignora_tildes(db_session):
    # Arrange
    _um(db_session, nombre="Categoría A", simbolo="CA")

    # Act
    resultado = listar_unidades_medida(db_session, buscar="categoria")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_unidades_medida_paginado
# ---------------------------------------------------------------------------

def test_listar_unidades_medida_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        _um(db_session, nombre=f"UM {i}", simbolo=f"U{i}")

    # Act
    items, total = listar_unidades_medida_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_unidades_medida_paginado_orden_simbolo_desc(db_session):
    # Arrange
    _um(db_session, nombre="Uno", simbolo="A")
    _um(db_session, nombre="Dos", simbolo="B")

    # Act
    items, _ = listar_unidades_medida_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="simbolo_desc"
    )

    # Assert
    assert [u.simbolo for u in items] == ["B", "A"]


# ---------------------------------------------------------------------------
# obtener_unidad_medida
# ---------------------------------------------------------------------------

def test_obtener_unidad_medida_existe(db_session):
    # Arrange
    creada = _um(db_session, nombre="Kilogramo", simbolo="KG")

    # Act
    obtenida = obtener_unidad_medida(db_session, creada.id)

    # Assert
    assert obtenida.id == creada.id


def test_obtener_unidad_medida_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_unidad_medida(db_session, 9999)
    except exceptions.UnidadMedidaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaNoEncontrada")


# ---------------------------------------------------------------------------
# actualizar_unidad_medida
# ---------------------------------------------------------------------------

def test_actualizar_unidad_medida_parcial(db_session):
    # Arrange
    creada = _um(db_session, nombre="Kilogramo", simbolo="KG")
    datos = schemas.UnidadMedidaUpdate(simbolo="KGM")

    # Act
    actualizada = actualizar_unidad_medida(db_session, creada.id, datos)

    # Assert
    assert actualizada.nombre == "Kilogramo"
    assert actualizada.simbolo == "KGM"


def test_actualizar_unidad_medida_conflicto_nombre(db_session):
    # Arrange
    _um(db_session, nombre="Kilogramo", simbolo="KG")
    otro = _um(db_session, nombre="Gramo", simbolo="GM")
    datos = schemas.UnidadMedidaUpdate(nombre="Kilogramo")

    # Act / Assert
    try:
        actualizar_unidad_medida(db_session, otro.id, datos)
    except exceptions.UnidadMedidaYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaYaExiste")


def test_actualizar_unidad_medida_no_existe(db_session):
    # Arrange
    datos = schemas.UnidadMedidaUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_unidad_medida(db_session, 9999, datos)
    except exceptions.UnidadMedidaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaNoEncontrada")


# ---------------------------------------------------------------------------
# eliminar_unidad_medida (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_unidad_medida_pasa_a_activo_falso(db_session):
    # Arrange
    creada = _um(db_session, nombre="Kilogramo", simbolo="KG")

    # Act
    eliminada = eliminar_unidad_medida(db_session, creada.id)

    # Assert
    assert eliminada.activo is False


def test_eliminar_unidad_medida_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_unidad_medida(db_session, 9999)
    except exceptions.UnidadMedidaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaNoEncontrada")


def test_eliminar_unidad_medida_en_uso_por_insumo_activo_lanza_en_uso(db_session):
    # Arrange
    um = _um(db_session, nombre="Kilogramo", simbolo="KG")
    insumo = Insumo(
        nombre="Insumo X",
        unidad_medida_id=um.id,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(insumo)
        db_session.commit()
        db_session.refresh(insumo)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        eliminar_unidad_medida(db_session, um.id)
    except exceptions.UnidadMedidaEnUso:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaEnUso")


def test_eliminar_unidad_medida_en_uso_por_insumo_quimico_activo_lanza_en_uso(db_session):
    # Arrange
    um = _um(db_session, nombre="Kilogramo", simbolo="KG")
    iq = InsumoQuimico(
        nombre="Quimico X",
        tipo=TipoQuimico.DETERGENTE,
        unidad_medida_id=um.id,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(iq)
        db_session.commit()
        db_session.refresh(iq)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        eliminar_unidad_medida(db_session, um.id)
    except exceptions.UnidadMedidaEnUso:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaEnUso")


def test_eliminar_unidad_medida_insumo_inactivo_no_bloquea(db_session):
    # Arrange
    um = _um(db_session, nombre="Kilogramo", simbolo="KG")
    insumo = Insumo(
        nombre="Insumo X",
        unidad_medida_id=um.id,
        activo=False,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(insumo)
        db_session.commit()
        db_session.refresh(insumo)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    eliminada = eliminar_unidad_medida(db_session, um.id)

    # Assert
    assert eliminada.activo is False
