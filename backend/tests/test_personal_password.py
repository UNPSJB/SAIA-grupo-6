import pytest
from src.personal import schemas, services
from src.personal.models import Personal
from src.personal.exceptions import DniDuplicado

def test_crear_persona_sin_password_genera_temporal_y_flag(session_factory):
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
        # password_temporal exposed as attribute
        assert hasattr(persona, "password_temporal")
        assert persona.password_temporal is not None
        # password is hashed
        from src.auth.services import verificar_password
        assert verificar_password(persona.password_temporal, persona.password)

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
        assert getattr(persona, "password_temporal", None) is None
