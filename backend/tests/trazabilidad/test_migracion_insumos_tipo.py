"""E9: la migración convierte `insumos.tipo` de insumo/producto a ingrediente/aditivo."""

import pytest
from sqlalchemy import text

from src.database import engine
from src.migrations.insumos_tipo import (
    migrar_aditivos_referencia,
    migrar_insumos_tipo,
)

ESQUEMA_VIEJO = (
    "CREATE TABLE insumos ("
    "id INTEGER NOT NULL, nombre VARCHAR NOT NULL, unidad_medida_id INTEGER NOT NULL, "
    "activo BOOLEAN NOT NULL, tipo VARCHAR(20) DEFAULT 'insumo' NOT NULL, "
    "PRIMARY KEY (id), "
    "CONSTRAINT ck_insumos_tipo_valido CHECK (tipo IN ('insumo', 'producto')), "
    "FOREIGN KEY(unidad_medida_id) REFERENCES unidades_medida (id))"
)


@pytest.fixture
def base_vieja(db):
    """`insumos` con el esquema anterior, un producto viejo referenciado y otro suelto."""
    with engine.connect() as conexion:
        conexion.execute(text("PRAGMA foreign_keys = OFF"))
        conexion.commit()
        with conexion.begin():
            conexion.execute(text("DROP TABLE insumos"))
            conexion.execute(text(ESQUEMA_VIEJO))
            conexion.execute(text("INSERT INTO unidades_medida (id, nombre, simbolo, activo) VALUES (1, 'Kilo', 'kg', 1)"))
            conexion.execute(
                text(
                    "INSERT INTO insumos (id, nombre, unidad_medida_id, activo, tipo) VALUES "
                    "(1, 'Harina', 1, 1, 'insumo'), (2, 'Sorbato de potasio', 1, 1, 'insumo'), "
                    "(3, 'Pan viejo', 1, 1, 'producto'), (4, 'Torta vieja', 1, 1, 'producto')"
                )
            )
            # Tabla legada que todavía referencia a un producto viejo.
            conexion.execute(
                text("CREATE TABLE lotes_legado (id INTEGER PRIMARY KEY, producto_id INTEGER REFERENCES insumos(id))")
            )
            conexion.execute(text("INSERT INTO lotes_legado VALUES (1, 3)"))
            # Una receta usa el sorbato como aditivo.
            conexion.execute(text("INSERT INTO productos (id, nombre, unidad_medida_id, activo) VALUES (1, 'Pan', 1, 1)"))
            conexion.execute(text("INSERT INTO recetas (id, producto_id, activo, creado_en) VALUES (1, 1, 1, '2026-01-01')"))
            conexion.execute(
                text(
                    "INSERT INTO versiones_receta (id, receta_id, numero, rendimiento, unidad_medida_id, creado_en) "
                    "VALUES (1, 1, 1, 10, 1, '2026-01-01')"
                )
            )
            conexion.execute(
                text(
                    "INSERT INTO receta_insumo (id, version_receta_id, insumo_id, cantidad, unidad_medida_id, clasificacion) "
                    "VALUES (1, 1, 1, 5, 1, 'ingrediente'), (2, 1, 2, 0.1, 1, 'aditivo')"
                )
            )
        conexion.execute(text("PRAGMA foreign_keys = ON"))
        conexion.commit()
    migrar_aditivos_referencia()
    yield
    with engine.begin() as conexion:
        conexion.execute(text("DROP TABLE IF EXISTS lotes_legado"))


def _filas():
    with engine.connect() as conexion:
        return {
            fila.id: fila
            for fila in conexion.execute(
                text(
                    "SELECT i.id, i.nombre, i.tipo, i.activo, a.numero_ins FROM insumos i "
                    "LEFT JOIN aditivos a ON a.id = i.aditivo_id"
                )
            )
        }


def test_convierte_los_tipos_y_conserva_los_ids(base_vieja):
    migrar_insumos_tipo()

    filas = _filas()
    assert filas[1].tipo == "ingrediente"
    # Se usaba como aditivo y el nombre coincide con la referencia.
    assert (filas[2].tipo, filas[2].numero_ins) == ("aditivo", "202")
    # Producto viejo referenciado: queda dado de baja; el suelto se borra.
    assert (filas[3].tipo, filas[3].activo) == ("ingrediente", 0)
    assert 4 not in filas


def test_el_esquema_nuevo_rechaza_el_tipo_producto(base_vieja):
    migrar_insumos_tipo()

    with engine.connect() as conexion:
        sql = conexion.execute(text("SELECT sql FROM sqlite_master WHERE name = 'insumos'")).scalar_one()
        indices = conexion.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'insumos'")
        ).scalars().all()
        rotas = conexion.execute(text("PRAGMA foreign_key_check")).fetchall()
    assert "'producto'" not in sql and "aditivo_id" in sql
    assert {"ix_insumos_nombre", "ix_insumos_tipo", "ix_insumos_aditivo_id"} <= set(indices)
    assert rotas == []


def test_es_idempotente(base_vieja):
    migrar_insumos_tipo()
    antes = _filas()
    migrar_insumos_tipo()
    assert _filas() == antes


def test_la_carga_de_referencia_no_duplica(base_vieja):
    migrar_aditivos_referencia()
    with engine.connect() as conexion:
        total = conexion.execute(text("SELECT COUNT(*) FROM aditivos")).scalar_one()
        aromatizante = conexion.execute(
            text("SELECT ins_opcional FROM clases_funcionales WHERE nombre = 'Aromatizante'")
        ).scalar_one()
    from src.aditivos.referencia import ADITIVOS

    assert total == len(ADITIVOS)
    assert aromatizante == 1
