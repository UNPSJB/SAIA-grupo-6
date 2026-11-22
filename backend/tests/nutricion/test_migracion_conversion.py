"""La densidad y el peso por unidad pasan del perfil nutricional al insumo."""

from decimal import Decimal

import pytest
from sqlalchemy import text

from src.database import engine
from src.migrations.base import columnas_de
from src.migrations.nutricion_conversion_en_insumo import migrar_conversion_a_insumo

TABLA = "perfiles_nutricionales_insumo"


@pytest.fixture
def perfil_viejo(db):
    """Esquema de antes: el perfil con su propia densidad y peso por unidad."""
    with engine.begin() as conexion:
        # Las tablas con los nombres de antes: hoy son `ingredientes` y
        # `perfiles_nutricionales_ingrediente`.
        conexion.execute(text("DROP TABLE IF EXISTS proveedores_insumos"))
        conexion.execute(text("DROP TABLE IF EXISTS insumos"))
        conexion.execute(
            text(
                "CREATE TABLE insumos (id INTEGER PRIMARY KEY, nombre VARCHAR NOT NULL, "
                "unidad_medida_id INTEGER NOT NULL, activo BOOLEAN NOT NULL, tipo VARCHAR(20), "
                "densidad_g_ml NUMERIC(10, 4), peso_unitario_g NUMERIC(10, 4))"
            )
        )
        conexion.execute(
            text(
                f"CREATE TABLE {TABLA} ("
                "insumo_id INTEGER NOT NULL PRIMARY KEY REFERENCES insumos(id) ON DELETE CASCADE, "
                "peso_unidad_g NUMERIC(14, 4), densidad_g_ml NUMERIC(14, 4), "
                "aporta_energia_sodio BOOLEAN, "
                "azucares_son_anadidos BOOLEAN NOT NULL DEFAULT 0, "
                "CONSTRAINT ck_perfil_insumo_peso CHECK (peso_unidad_g IS NULL OR peso_unidad_g > 0), "
                "CONSTRAINT ck_perfil_insumo_densidad CHECK (densidad_g_ml IS NULL OR densidad_g_ml > 0))"
            )
        )
        conexion.execute(text("INSERT INTO unidades_medida (id, nombre, simbolo, activo) VALUES (1, 'u', 'u', 1)"))
        conexion.execute(
            text(
                "INSERT INTO insumos (id, nombre, unidad_medida_id, activo, tipo, densidad_g_ml, peso_unitario_g) VALUES "
                "(1, 'Leche', 1, 1, 'ingrediente', NULL, NULL), "
                "(2, 'Huevo', 1, 1, 'ingrediente', NULL, 55), "
                "(3, 'Harina', 1, 1, 'ingrediente', NULL, NULL)"
            )
        )
        conexion.execute(
            text(
                f"INSERT INTO {TABLA} VALUES "
                "(1, NULL, 1.03, 0, 0), "
                "(2, 50, NULL, 0, 1), "
                "(3, NULL, NULL, 1, 0)"
            )
        )
    yield
    with engine.begin() as conexion:
        conexion.execute(text("PRAGMA foreign_keys = OFF"))
        conexion.execute(text(f"DROP TABLE IF EXISTS {TABLA}"))
        conexion.execute(text("DROP TABLE IF EXISTS insumos"))
        conexion.execute(text("PRAGMA foreign_keys = ON"))


def _insumos() -> dict[str, tuple]:
    with engine.begin() as conexion:
        filas = conexion.execute(
            text("SELECT nombre, densidad_g_ml, peso_unitario_g FROM insumos")
        ).all()
    return {
        n: tuple(None if v is None else Decimal(str(v)) for v in (d, p)) for n, d, p in filas
    }


def test_copia_al_insumo_lo_que_no_tenia(perfil_viejo):
    migrar_conversion_a_insumo()

    insumos = _insumos()
    assert insumos["Leche"] == (Decimal("1.03"), None)
    assert insumos["Harina"] == (None, None)


def test_si_los_dos_tienen_valor_queda_el_del_insumo(perfil_viejo):
    migrar_conversion_a_insumo()

    assert _insumos()["Huevo"] == (None, Decimal("55"))


def test_saca_las_columnas_del_perfil_y_conserva_el_resto(perfil_viejo):
    migrar_conversion_a_insumo()

    assert {"densidad_g_ml", "peso_unidad_g"}.isdisjoint(columnas_de(TABLA))
    with engine.begin() as conexion:
        filas = conexion.execute(
            text(f"SELECT insumo_id, aporta_energia_sodio, azucares_son_anadidos FROM {TABLA} ORDER BY insumo_id")
        ).all()
    assert [tuple(f) for f in filas] == [(1, 0, 0), (2, 0, 1), (3, 1, 0)]


def test_es_idempotente(perfil_viejo):
    migrar_conversion_a_insumo()
    migrar_conversion_a_insumo()

    assert _insumos()["Leche"] == (Decimal("1.03"), None)
