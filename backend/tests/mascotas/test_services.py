import pytest
from sqlalchemy.orm import Session
from src.mascotas.services import listar_mascotas
from tests.database import session

def test_listar_mascotas(session: Session) -> None:
    mascotas = listar_mascotas(session)
    assert len(mascotas) == 3
