"""Tests unitarios de services del módulo `elementoLimpieza`."""

from datetime import date

from src.exceptions import ConflictoRegistroInactivo
from src.elementoLimpieza import exceptions
from src.elementoLimpieza.models import ElementoLimpieza
from src.elementoLimpieza.schemas import ElementoLimpiezaCreate, ElementoLimpiezaUpdate
from src.elementoLimpieza.services import (
    actualizar_elemento_limpieza,
    crear_elemento_limpieza,
    dar_de_baja_elemento_limpieza,
    listar_elementos_limpieza,
    listar_elementos_limpieza_paginado,
    listar_opciones_elementos,
    obtener_elemento_limpieza,
    registrar_recambio_elemento,
)
from tests.database import db_session


def _elemento(db, nombre="Detergente", frecuencia=30, activo=True, fecha_recambio=None):
    fila = ElementoLimpieza(
        nombre=nombre,
        frecuencia_recambio_dias=frecuencia,
        fecha_ultimo_recambio=fecha_recambio,
        activo=activo,
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
# crear_elemento_limpieza
# ---------------------------------------------------------------------------

def test_crear_elemento_limpieza_caso_feliz(db_session):
    # Arrange
    datos = ElementoLimpiezaCreate(
        nombre="Detergente",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2024, 1, 15),
    )

    # Act
    creado = crear_elemento_limpieza(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Detergente"
    assert creado.fecha_ultimo_recambio == date(2024, 1, 15)
    assert creado.activo is True


def test_crear_elemento_limpieza_fecha_ultimo_recambio_propia(db_session):
    # Arrange
    datos = ElementoLimpiezaCreate(
        nombre="Detergente",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2024, 6, 1),
    )

    # Act
    creado = crear_elemento_limpieza(db_session, datos)

    # Assert
    assert creado.fecha_ultimo_recambio == date(2024, 6, 1)


def test_crear_elemento_limpieza_nombre_duplicado_activo_lanza_ya_existe(db_session):
    # Arrange
    _elemento(db_session, nombre="Detergente")
    datos = ElementoLimpiezaCreate(nombre="Detergente")

    # Act / Assert
    try:
        crear_elemento_limpieza(db_session, datos)
    except exceptions.ElementoLimpiezaYaExiste as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba ElementoLimpiezaYaExiste")


def test_crear_elemento_limpieza_nombre_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    inactivo = _elemento(db_session, nombre="Detergente", activo=False)
    datos = ElementoLimpiezaCreate(nombre="Detergente")

    # Act / Assert
    try:
        crear_elemento_limpieza(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "nombre"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_elemento_limpieza_nombre_en_limite_maximo(db_session):
    # Arrange (String(40))
    nombre = "A" * 40
    datos = ElementoLimpiezaCreate(nombre=nombre)

    # Act
    creado = crear_elemento_limpieza(db_session, datos)

    # Assert
    assert creado.nombre == nombre


def test_crear_elemento_limpieza_frecuencia_minima_1(db_session):
    # Arrange (ge=1)
    datos = ElementoLimpiezaCreate(nombre="Detergente", frecuencia_recambio_dias=1)

    # Act
    creado = crear_elemento_limpieza(db_session, datos)

    # Assert
    assert creado.frecuencia_recambio_dias == 1


# ---------------------------------------------------------------------------
# listar_elementos_limpieza
# ---------------------------------------------------------------------------

def test_listar_elementos_limpieza_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_elementos_limpieza(db_session)

    # Assert
    assert resultado == []


def test_listar_elementos_limpieza_solo_activos_por_defecto(db_session):
    # Arrange
    _elemento(db_session, nombre="Activo")
    _elemento(db_session, nombre="Inactivo", activo=False)

    # Act
    resultado = listar_elementos_limpieza(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].nombre == "Activo"


def test_listar_elementos_limpieza_buscar_ignora_tildes(db_session):
    # Arrange
    _elemento(db_session, nombre="Jab\u00f3n Liquido")

    # Act
    resultado = listar_elementos_limpieza(db_session, buscar="jabon")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_elementos_limpieza_paginado
# ---------------------------------------------------------------------------

def test_listar_elementos_limpieza_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        _elemento(db_session, nombre=f"Elem {i}")

    # Act
    items, total = listar_elementos_limpieza_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_elementos_limpieza_paginado_orden_frecuencia_desc(db_session):
    # Arrange
    _elemento(db_session, nombre="A", frecuencia=10)
    _elemento(db_session, nombre="B", frecuencia=30)

    # Act
    items, _ = listar_elementos_limpieza_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="frecuencia_desc"
    )

    # Assert
    assert [e.nombre for e in items] == ["B", "A"]


# ---------------------------------------------------------------------------
# listar_opciones_elementos
# ---------------------------------------------------------------------------

def test_listar_opciones_elementos_solo_activos(db_session):
    # Arrange
    _elemento(db_session, nombre="Activo")
    _elemento(db_session, nombre="Inactivo", activo=False)

    # Act
    opciones = listar_opciones_elementos(db_session)

    # Assert
    assert len(opciones) == 1
    assert opciones[0].nombre == "Activo"
    assert opciones[0].id is not None


# ---------------------------------------------------------------------------
# obtener_elemento_limpieza
# ---------------------------------------------------------------------------

def test_obtener_elemento_limpieza_existe(db_session):
    # Arrange
    creado = _elemento(db_session, nombre="Detergente")

    # Act
    obtenido = obtener_elemento_limpieza(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_elemento_limpieza_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_elemento_limpieza(db_session, 9999)
    except exceptions.ElementoLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ElementoLimpiezaNoEncontrado")


# ---------------------------------------------------------------------------
# actualizar_elemento_limpieza
# ---------------------------------------------------------------------------

def test_actualizar_elemento_limpieza_parcial(db_session):
    # Arrange
    creado = _elemento(db_session, nombre="Detergente", frecuencia=30)
    datos = ElementoLimpiezaUpdate(frecuencia_recambio_dias=60)

    # Act
    actualizado = actualizar_elemento_limpieza(db_session, creado.id, datos)

    # Assert
    assert actualizado.nombre == "Detergente"
    assert actualizado.frecuencia_recambio_dias == 60


def test_actualizar_elemento_limpieza_conflicto_nombre(db_session):
    # Arrange
    _elemento(db_session, nombre="Detergente")
    otro = _elemento(db_session, nombre="Jabon")
    datos = ElementoLimpiezaUpdate(nombre="Detergente")

    # Act / Assert
    try:
        actualizar_elemento_limpieza(db_session, otro.id, datos)
    except exceptions.ElementoLimpiezaYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba ElementoLimpiezaYaExiste")


def test_actualizar_elemento_limpieza_no_existe(db_session):
    # Arrange
    datos = ElementoLimpiezaUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_elemento_limpieza(db_session, 9999, datos)
    except exceptions.ElementoLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ElementoLimpiezaNoEncontrado")


# ---------------------------------------------------------------------------
# dar_de_baja_elemento_limpieza (baja lógica)
# ---------------------------------------------------------------------------

def test_dar_de_baja_elemento_limpieza_pasa_a_activo_falso(db_session):
    # Arrange
    creado = _elemento(db_session, nombre="Detergente")

    # Act
    dado_de_baja = dar_de_baja_elemento_limpieza(db_session, creado.id)

    # Assert
    assert dado_de_baja.activo is False


def test_dar_de_baja_elemento_limpieza_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        dar_de_baja_elemento_limpieza(db_session, 9999)
    except exceptions.ElementoLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ElementoLimpiezaNoEncontrado")


# ---------------------------------------------------------------------------
# registrar_recambio_elemento (usa hoy() -> monkeypatch)
# ---------------------------------------------------------------------------

def test_registrar_recambio_elemento_actualiza_fecha(db_session, monkeypatch):
    # Arrange
    import src.elementoLimpieza.services as svc

    monkeypatch.setattr(svc, "hoy", lambda: date(2024, 3, 10))
    creado = _elemento(db_session, nombre="Detergente", fecha_recambio=date(2024, 1, 1))

    # Act
    actualizado = registrar_recambio_elemento(db_session, creado.id)

    # Assert
    assert actualizado.fecha_ultimo_recambio == date(2024, 3, 10)
