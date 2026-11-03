"""Tests unitarios de validadores de schemas del módulo `personal`."""

import pytest

from src.personal import exceptions
from src.personal.schemas import PersonaCreate, PersonaUpdate


def test_persona_create_valido():
    # Arrange
    datos = {
        "nombre": "Ana", "apellido": "Garcia", "dni": "87654321",
        "email": "ana@test.com", "password": "password123", "puede_operar": True,
    }

    # Act
    persona = PersonaCreate(**datos)

    # Assert
    assert persona.nombre == "Ana"
    assert persona.dni == "87654321"
    assert persona.email == "ana@test.com"


def test_persona_create_nombre_solo_letras():
    # Arrange (RE_NOMBRE_SOLO_LETRAS rechaza digitos)
    datos = {"nombre": "Ana1", "apellido": "Garcia", "dni": "87654321", "email": "ana@test.com", "puede_operar": True}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        PersonaCreate(**datos)


def test_persona_create_dni_invalido():
    # Arrange (RE_DNI = 7 u 8 digitos)
    datos = {"nombre": "Ana", "apellido": "Garcia", "dni": "123", "email": "ana@test.com", "puede_operar": True}

    # Act / Assert
    with pytest.raises(exceptions.DniInvalido):
        PersonaCreate(**datos)


def test_persona_create_email_invalido():
    # Arrange
    datos = {"nombre": "Ana", "apellido": "Garcia", "dni": "87654321", "email": "no-es-email", "puede_operar": True}

    # Act / Assert
    with pytest.raises(exceptions.EmailInvalido):
        PersonaCreate(**datos)


def test_persona_create_password_muy_corta():
    # Arrange (menos de 8 caracteres)
    datos = {"nombre": "Ana", "apellido": "Garcia", "dni": "87654321", "email": "ana@test.com", "password": "123", "puede_operar": True}

    # Act / Assert
    with pytest.raises(exceptions.PasswordInvalida):
        PersonaCreate(**datos)


def test_persona_update_parcial_solo_nombre():
    # Arrange
    datos = {"nombre": "Ana"}

    # Act
    update = PersonaUpdate(**datos)

    # Assert
    assert update.nombre == "Ana"
    assert update.dni is None


def test_persona_update_dni_invalido():
    # Arrange
    datos = {"dni": "123"}

    # Act / Assert
    with pytest.raises(exceptions.DniInvalido):
        PersonaUpdate(**datos)


def test_persona_update_email_none_se_tolerar():
    # Arrange
    datos = {"email": None, "nombre": "Ana"}

    # Act
    update = PersonaUpdate(**datos)

    # Assert
    assert update.email is None
    assert update.nombre == "Ana"


@pytest.mark.parametrize(
    "dni",
    ["1234567", "12345678"],
)
def test_persona_create_dni_valido_7_u_8_digitos(dni):
    # Arrange
    datos = {"nombre": "Ana", "apellido": "Garcia", "dni": dni, "email": "ana@test.com", "puede_operar": True}

    # Act
    persona = PersonaCreate(**datos)

    # Assert
    assert persona.dni == dni


@pytest.mark.parametrize(
    "dni",
    ["123456", "123456789", "abc1234"],
)
def test_persona_create_dni_invalido_parametrizado(dni):
    # Arrange
    datos = {"nombre": "Ana", "apellido": "Garcia", "dni": dni, "email": "ana@test.com", "puede_operar": True}

    # Act / Assert
    with pytest.raises(exceptions.DniInvalido):
        PersonaCreate(**datos)
