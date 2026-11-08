"""La migración copia los lotes históricos a `lotes_producto` (una sola vez)."""

import pytest
from sqlalchemy import text

from src.database import engine
from src.migrations.base import crear_bitacora
from src.migrations.trazabilidad import migrar_trazabilidad


@pytest.fixture
def base_legacy(db):
    with engine.begin() as conexion:
        conexion.execute(text("INSERT INTO unidades_medida (nombre, simbolo, activo) VALUES ('Kilo', 'kg', 1)"))
        # Fila del esquema viejo: hoy el CHECK de `insumos` ya no admite 'producto'.
        conexion.execute(text("PRAGMA ignore_check_constraints = ON"))
        conexion.execute(
            text(
                "INSERT INTO insumos (nombre, unidad_medida_id, activo, tipo) "
                "VALUES ('Pan', 1, 1, 'producto')"
            )
        )
        conexion.execute(text("PRAGMA ignore_check_constraints = OFF"))
        conexion.execute(
            text(
                "CREATE TABLE lotes (id INTEGER PRIMARY KEY, codigo_lote VARCHAR(50), "
                "producto_id INTEGER, producto_nombre VARCHAR(120), cantidad_planificada INTEGER, "
                "cantidad_producida INTEGER, estado VARCHAR(20), fecha_inicio DATETIME)"
            )
        )
        conexion.execute(
            text(
                "INSERT INTO lotes VALUES "
                "(1, 'L-1', NULL, 'Pan', 100, 90, 'Finalizado', '2026-01-01 10:00:00'),"
                "(2, 'L-2', NULL, 'Pan', 50, 0, 'Pendiente', '2026-01-02 10:00:00'),"
                "(3, 'L-3', NULL, 'Tarta', 10, 0, 'Cancelado', '2026-01-03 10:00:00')"
            )
        )
    crear_bitacora()
    yield
    with engine.begin() as conexion:
        conexion.execute(text("DROP TABLE lotes"))
        conexion.execute(text("DROP TABLE schema_migrations"))


def test_los_lotes_historicos_pasan_a_lotes_producto(base_legacy):
    migrar_trazabilidad()

    with engine.begin() as conexion:
        productos = {r[0] for r in conexion.execute(text("SELECT nombre FROM productos"))}
        lotes = conexion.execute(
            text(
                "SELECT lp.id, lp.numero_lote, p.nombre, lp.estado, lp.cantidad_objetivo, "
                "lp.cantidad_producida, lp.version_receta_id "
                "FROM lotes_producto lp JOIN productos p ON p.id = lp.producto_id ORDER BY lp.id"
            )
        ).all()

    assert productos == {"Pan", "Tarta"}
    assert [tuple(l) for l in lotes] == [
        (1, "L-1", "Pan", "terminado", 100, 90, None),
        (2, "L-2", "Pan", "en_proceso", 50, None, None),
        (3, "L-3", "Tarta", "cancelado", 10, None, None),
    ]


def test_la_migracion_es_idempotente(base_legacy):
    migrar_trazabilidad()
    migrar_trazabilidad()

    with engine.begin() as conexion:
        assert conexion.execute(text("SELECT COUNT(*) FROM lotes_producto")).scalar() == 3
        assert conexion.execute(text("SELECT COUNT(*) FROM productos")).scalar() == 2
