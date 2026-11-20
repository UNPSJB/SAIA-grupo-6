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
        for tabla, campo in (("insumos", "perfil_declaracion"), ("productos", "conservacion")):
            columnas = {c["name"] for c in inspect(conexion).get_columns(tabla)}
            if campo not in columnas:
                conexion.execute(text(f'ALTER TABLE "{tabla}" ADD COLUMN "{campo}" JSON'))
        if "borradores_rotulado" in inspect(conexion).get_table_names():
            columnas = {c["name"] for c in inspect(conexion).get_columns("borradores_rotulado")}
            if "archivado" not in columnas:
                conexion.execute(text('ALTER TABLE borradores_rotulado ADD COLUMN archivado BOOLEAN NOT NULL DEFAULT 0'))
        columnas = {c["name"] for c in inspect(conexion).get_columns("insumos")}
        for campo, tipo in (("perfil_actualizado_en", "DATETIME"), ("perfil_actualizado_por_id", "INTEGER")):
            if campo not in columnas:
                conexion.execute(text(f'ALTER TABLE insumos ADD COLUMN "{campo}" {tipo}'))
        conexion.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(clave TEXT PRIMARY KEY, aplicada_en DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ))
        conexion.execute(text(
            "INSERT OR IGNORE INTO schema_migrations (clave) VALUES ('rotulado_hu106_declaraciones')"
        ))
