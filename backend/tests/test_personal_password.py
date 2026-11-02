import pytest
from src.personal import schemas, services
from src.personal.models import Personal
from src.personal.exceptions import DniDuplicado
from src.auth.services import verificar_password


def test_crear_persona_sin_password_usa_dni_y_flag(session_factory):
    with session_factory() as db:
        persona_in = schemas.PersonaCreate(
            nombre="Test",
            dni="12345678",
            email="test@example.com",
            password=None,
            puede_operar=True,
        )
        persona = services.crear_persona(db, persona_in)
        assert persona.debe_cambiar_password is True
        # La contraseña inicial es el DNI
        assert verificar_password("12345678", persona.password)


def test_crear_persona_con_password_flag(session_factory):
    with session_factory() as db:
        persona_in = schemas.PersonaCreate(
            nombre="TestDos",
            dni="12345679",
            email="test2@example.com",
            password="secreta123",
            puede_operar=True,
        )
        persona = services.crear_persona(db, persona_in)
        assert persona.debe_cambiar_password is False
        assert verificar_password("secreta123", persona.password)
