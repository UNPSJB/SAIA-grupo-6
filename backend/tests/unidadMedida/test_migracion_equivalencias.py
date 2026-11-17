"""La migración completa tipo y factor de las unidades conocidas (una sola vez)."""

from decimal import Decimal

import pytest
from sqlalchemy import text

from src.database import engine
from src.migrations.base import crear_bitacora
from src.migrations.unidades_medida_tipo_factor import asignar_equivalencias_conocidas
from src.unidadMedida.constants import equivalencia_conocida

CLAVE = "unidades_medida_equivalencias_conocidas"


@pytest.fixture
def unidades_migradas(db):
    """Unidades como las dejó la migración anterior: todas 'unidad' con factor 1."""
    crear_bitacora()
    with engine.begin() as conexion:
        conexion.execute(text("DELETE FROM schema_migrations WHERE clave = :c"), {"c": CLAVE})
        conexion.execute(
            text(
                "INSERT INTO unidades_medida (nombre, simbolo, activo) VALUES "
                "('kilogramo', 'kg', 1), ('litro', 'lt', 1), ('Centímetro cúbico', 'cc', 1), "
                "('miligramo', 'mgr', 1), ('docena', 'doc', 1), ('hora', 'hs', 1)"
            )
        )
        # Una que alguien ya corrigió a mano: no se toca.
        conexion.execute(
            text(
                "INSERT INTO unidades_medida (nombre, simbolo, activo, tipo, factor_a_base) "
                "VALUES ('gramo', 'gr', 1, 'masa', 2)"
            )
        )
    yield
    with engine.begin() as conexion:
        conexion.execute(text("DELETE FROM schema_migrations WHERE clave = :c"), {"c": CLAVE})


def _unidades() -> dict[str, tuple[str, Decimal]]:
    with engine.begin() as conexion:
        filas = conexion.execute(
            text("SELECT nombre, tipo, factor_a_base FROM unidades_medida")
        ).all()
    return {nombre: (tipo, Decimal(str(factor))) for nombre, tipo, factor in filas}


def test_asigna_tipo_y_factor_a_las_conocidas(unidades_migradas):
    asignar_equivalencias_conocidas()

    unidades = _unidades()
    assert unidades["kilogramo"] == ("masa", Decimal("1000"))
    assert unidades["litro"] == ("volumen", Decimal("1000"))
    assert unidades["Centímetro cúbico"] == ("volumen", Decimal("1"))
    assert unidades["miligramo"] == ("masa", Decimal("0.001"))
    assert unidades["docena"] == ("unidad", Decimal("12"))


def test_deja_igual_las_desconocidas_y_las_editadas(unidades_migradas):
    asignar_equivalencias_conocidas()

    unidades = _unidades()
    assert unidades["hora"] == ("unidad", Decimal("1"))
    assert unidades["gramo"] == ("masa", Decimal("2"))


def test_corre_una_sola_vez(unidades_migradas):
    asignar_equivalencias_conocidas()
    with engine.begin() as conexion:
        conexion.execute(
            text("UPDATE unidades_medida SET tipo = 'unidad', factor_a_base = 1 WHERE nombre = 'litro'")
        )

    asignar_equivalencias_conocidas()

    assert _unidades()["litro"] == ("unidad", Decimal("1"))


def test_equivalencia_ignora_tildes_mayusculas_y_espacios():
    assert equivalencia_conocida("  Centímetro   Cúbico ") == {"tipo": "volumen", "factor_a_base": 1}
    assert equivalencia_conocida("metro") is None
