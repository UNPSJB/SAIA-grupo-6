import os
import pytest
from pydantic import ValidationError
from src.config import Settings

def test_secret_key_rechaza_placeholder_y_cambiar():
    # vacío
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, SECRET_KEY="", DB_URL="sqlite://")
    assert "SECRET_KEY sigue con el valor de ejemplo" in str(exc.value)

    # contiene pega-aqui
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, SECRET_KEY="pega-aqui-la-clave", DB_URL="sqlite://")
    assert "marcador de ejemplo" in str(exc.value)

    # contiene cambiar
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, SECRET_KEY="cambiar-en-produccion-12345678901234567890", DB_URL="sqlite://")
    assert "marcador de ejemplo" in str(exc.value)

    # válida
    s = Settings(_env_file=None, SECRET_KEY="x"*40, DB_URL="sqlite://")
    assert s.SECRET_KEY == "x"*40
