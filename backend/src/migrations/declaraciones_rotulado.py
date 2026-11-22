"""HU106: ampliación aditiva. No infiere evaluaciones de datos anteriores."""
from sqlalchemy import inspect, text


def migrar_declaraciones_rotulado(motor=None):
    # Motor inyectable para comprobar esquemas anteriores sin tocar la base real.
    if motor is None:
        from src.database import engine
        motor = engine
    from src.rotulado.models import RevisionDeclaracionRotulado
    RevisionDeclaracionRotulado.__table__.create(motor, checkfirst=True)
    with motor.begin() as conexion:
        # Los alérgenos y la evaluación de cada ingrediente los agrega
        # `migrar_alergenos` (el perfil en JSON del insumo se reemplazó por
        # las tablas de alérgenos al unificar con el refactor de ingredientes).
        columnas = {c["name"] for c in inspect(conexion).get_columns("productos")}
        if "conservacion" not in columnas:
            conexion.execute(text('ALTER TABLE "productos" ADD COLUMN "conservacion" JSON'))
        if "borradores_rotulado" in inspect(conexion).get_table_names():
            columnas = {c["name"] for c in inspect(conexion).get_columns("borradores_rotulado")}
            if "archivado" not in columnas:
                conexion.execute(text('ALTER TABLE borradores_rotulado ADD COLUMN archivado BOOLEAN NOT NULL DEFAULT 0'))
        conexion.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(clave TEXT PRIMARY KEY, aplicada_en DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ))
        conexion.execute(text(
            "INSERT OR IGNORE INTO schema_migrations (clave) VALUES ('rotulado_hu106_declaraciones')"
        ))

