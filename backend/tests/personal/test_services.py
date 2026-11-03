"""Tests unitarios de services del módulo `personal`."""

from datetime import date

from src.exceptions import ConflictoRegistroInactivo
from src.personal import exceptions, schemas
from src.personal.models import Personal
from src.personal.services import (
    autenticar_persona,
    crear_persona,
    eliminar_persona,
    leer_persona,
    listar_personas,
    listar_personas_paginado,
    modificar_persona,
)
from tests.database import db_session


def _personal(
    db,
    nombre="Juan",
    apellido="Perez",
    dni="12345678",
    email="juan@test.com",
    activo=True,
    password="password123",
    puede_operar=True,
    puede_administrar=False,
):
    fila = Personal(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        email=email,
        password=password,
        puede_operar=puede_operar,
        puede_administrar=puede_administrar,
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
# crear_persona
# ---------------------------------------------------------------------------

def test_crear_persona_caso_feliz(db_session):
    # Arrange
    datos = schemas.PersonaCreate(
        nombre="Ana", apellido="Garcia", dni="87654321", email="ana@test.com",
        password="password123", puede_operar=True,
    )

    # Act
    creada = crear_persona(db_session, datos)

    # Assert
    assert creada.id is not None
    assert creada.nombre == "Ana"
    assert creada.dni == "87654321"
    assert creada.email == "ana@test.com"
    assert creada.activo is True


def test_crear_persona_dni_duplicado_activo_lanza_dni_duplicado(db_session):
    # Arrange
    _personal(db_session, dni="12345678", email="juan@test.com")
    datos = schemas.PersonaCreate(
        nombre="Otro", apellido="Uno", dni="12345678", email="otro@test.com",
        password="password123", puede_operar=True,
    )

    # Act / Assert
    try:
        crear_persona(db_session, datos)
    except exceptions.DniDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba DniDuplicado")


def test_crear_persona_email_duplicado_activo_lanza_email_duplicado(db_session):
    # Arrange
    _personal(db_session, dni="12345678", email="juan@test.com")
    datos = schemas.PersonaCreate(
        nombre="Otro", apellido="Uno", dni="11111111", email="juan@test.com",
        password="password123", puede_operar=True,
    )

    # Act / Assert
    try:
        crear_persona(db_session, datos)
    except exceptions.EmailDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba EmailDuplicado")


def test_crear_persona_dni_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    inactivo = _personal(db_session, dni="12345678", email="juan@test.com", activo=False)
    datos = schemas.PersonaCreate(
        nombre="Otro", apellido="Uno", dni="12345678", email="otro@test.com",
        password="password123", puede_operar=True,
    )

    # Act / Assert
    try:
        crear_persona(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "dni"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


def test_crear_persona_email_duplicado_inactivo_lanza_conflicto(db_session):
    # Arrange
    inactivo = _personal(db_session, dni="12345678", email="juan@test.com", activo=False)
    datos = schemas.PersonaCreate(
        nombre="Otro", apellido="Uno", dni="11111111", email="juan@test.com",
        password="password123", puede_operar=True,
    )

    # Act / Assert
    try:
        crear_persona(db_session, datos)
    except ConflictoRegistroInactivo as e:
        assert e.status_code == 409
        assert e.detail["id"] == inactivo.id
        assert e.detail["campo"] == "email"
    else:
        raise AssertionError("Se esperaba ConflictoRegistroInactivo")


# ---------------------------------------------------------------------------
# listar_personas
# ---------------------------------------------------------------------------

def test_listar_personas_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_personas(db_session)

    # Assert
    assert resultado == []


def test_listar_personas_solo_activos_por_defecto(db_session):
    # Arrange
    _personal(db_session, dni="11111111", email="a@test.com")
    _personal(db_session, dni="22222222", email="b@test.com", activo=False)

    # Act
    resultado = listar_personas(db_session)

    # Assert
    assert len(resultado) == 1


def test_listar_personas_incluyendo_inactivos(db_session):
    # Arrange
    _personal(db_session, dni="11111111", email="a@test.com")
    _personal(db_session, dni="22222222", email="b@test.com", activo=False)

    # Act
    resultado = listar_personas(db_session, incluir_inactivos=True)

    # Assert
    assert len(resultado) == 2


def test_listar_personas_buscar_ignora_tildes(db_session):
    # Arrange
    _personal(db_session, nombre="Jos\u00e9", apellido="Gomez", dni="11111111", email="jose@test.com")

    # Act
    resultado = listar_personas(db_session, buscar="jose")

    # Assert
    assert len(resultado) == 1


def test_listar_personas_filtro_rol_operador(db_session):
    # Arrange
    _personal(db_session, dni="11111111", email="a@test.com", puede_operar=True)
    _personal(db_session, dni="22222222", email="b@test.com", puede_operar=True, puede_administrar=True)

    # Act
    resultado = listar_personas(db_session, rol="operador")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_personas_paginado
# ---------------------------------------------------------------------------

def test_listar_personas_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        _personal(db_session, dni=f"{i:08d}", email=f"u{i}@test.com")

    # Act
    items, total = listar_personas_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


def test_listar_personas_paginado_orden_dni_desc(db_session):
    # Arrange
    _personal(db_session, dni="11111111", email="a@test.com")
    _personal(db_session, dni="22222222", email="b@test.com")

    # Act
    items, _ = listar_personas_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=10, orden="dni_desc"
    )

    # Assert
    assert [p.dni for p in items] == ["22222222", "11111111"]


# ---------------------------------------------------------------------------
# leer_persona
# ---------------------------------------------------------------------------

def test_leer_persona_existe(db_session):
    # Arrange
    creada = _personal(db_session, dni="12345678", email="juan@test.com")

    # Act
    leida = leer_persona(db_session, creada.id)

    # Assert
    assert leida.id == creada.id


def test_leer_persona_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_persona(db_session, 9999)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


# ---------------------------------------------------------------------------
# modificar_persona
# ---------------------------------------------------------------------------

def test_modificar_persona_parcial_exclude_unset(db_session):
    # Arrange
    creada = _personal(db_session, dni="12345678", email="juan@test.com")
    datos = schemas.PersonaUpdate(nombre="Juan Carlos")

    # Act
    modificada = modificar_persona(db_session, creada.id, datos)

    # Assert
    assert modificada.nombre == "Juan Carlos"
    assert modificada.dni == "12345678"


def test_modificar_persona_conflicto_dni(db_session):
    # Arrange
    _personal(db_session, dni="12345678", email="juan@test.com")
    otro = _personal(db_session, dni="87654321", email="otro@test.com")
    datos = schemas.PersonaUpdate(dni="12345678")

    # Act / Assert
    try:
        modificar_persona(db_session, otro.id, datos)
    except exceptions.DniDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba DniDuplicado")


def test_modificar_persona_no_existe(db_session):
    # Arrange
    datos = schemas.PersonaUpdate(nombre="Otro")

    # Act / Assert
    try:
        modificar_persona(db_session, 9999, datos)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


# ---------------------------------------------------------------------------
# eliminar_persona (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_persona_pasa_a_activo_falso(db_session):
    # Arrange
    creada = _personal(db_session, dni="12345678", email="juan@test.com")

    # Act
    eliminada = eliminar_persona(db_session, creada.id)

    # Assert
    assert eliminada.activo is False


def test_eliminar_persona_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_persona(db_session, 9999)
    except exceptions.PersonaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba PersonaNoEncontrada")


# ---------------------------------------------------------------------------
# autenticar_persona (pocos hashes bcrypt)
# ---------------------------------------------------------------------------

def test_autenticar_persona_credenciales_correctas(db_session):
    # Arrange
    creada = _personal(db_session, dni="12345678", email="juan@test.com", password="password123")

    # Act
    persona = autenticar_persona(db_session, "12345678", "password123")

    # Assert
    assert persona.id == creada.id


def test_autenticar_persona_password_incorrecta(db_session):
    # Arrange
    _personal(db_session, dni="12345678", email="juan@test.com", password="password123")

    # Act / Assert
    try:
        autenticar_persona(db_session, "12345678", "otrapassword")
    except Exception:
        pass
    else:
        raise AssertionError("Se esperaba error de autenticacion")


def test_autenticar_persona_dni_inexistente(db_session):
    # Arrange

    # Act / Assert
    try:
        autenticar_persona(db_session, "00000000", "cualquiera")
    except Exception:
        pass
    else:
        raise AssertionError("Se esperaba error de autenticacion")
