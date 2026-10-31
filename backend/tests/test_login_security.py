import pytest
from fastapi import HTTPException
from src.personal.services import autenticar_persona
from src.personal.models import Personal

def test_login_dni_inexistente_mensaje_unificado(session_factory):
    with session_factory() as db:
        with pytest.raises(HTTPException) as exc:
            autenticar_persona(db, "00000000", "cualquier")
        assert exc.value.status_code == 401
        assert exc.value.detail == "DNI o contraseña incorrectos."

def test_login_password_incorrecta_mensaje_unificado(session_factory):
    with session_factory() as db:
        user = Personal(nombre="C", dni="33333333", email="c@test.com", password="hashed", puede_operar=True)
        # Use dummy hash, but verification will fail
        db.add(user)
        db.commit()
        db.refresh(user)
        with pytest.raises(HTTPException) as exc:
            autenticar_persona(db, "33333333", "wrong")
        assert exc.value.status_code == 401
        assert exc.value.detail == "DNI o contraseña incorrectos."
