import logging

from sqlalchemy import inspect, text

from src.database import engine

from .base import columnas_de

logger = logging.getLogger(__name__)


_SECTOR_SIN_ASIGNAR = "Sin sector asignado (migración)"


def sector_id_conforme(inspector) -> bool:
    """Indica si equipos ya tiene la relación obligatoria con sectores."""
    columnas = {columna["name"]: columna for columna in inspector.get_columns("equipos")}
    sector_id = columnas.get("sector_id")
    if sector_id is None or sector_id["nullable"]:
        return False

    return any(
        fk["referred_table"] == "sectores"
        and fk["constrained_columns"] == ["sector_id"]
        for fk in inspector.get_foreign_keys("equipos")
    )


def migrar_equipos_a_sectores() -> None:
    """Reemplaza la ubicación heredada por una relación obligatoria a Sector.

    SQLite no permite agregar una columna NOT NULL con FK a una tabla con filas.
    Por eso se reconstruye únicamente ``equipos`` dentro de una transacción. Las
    tablas que lo referencian conservan sus ``equipo_id`` y la columna
    ``ubicacion`` queda como historial para no descartar el dato original.
    """
    columnas = columnas_de("equipos")
    tiene_ubicacion = "ubicacion" in columnas
    tiene_sector_id = "sector_id" in columnas

    with engine.connect() as conexion:
        # La reconstrucción reemplaza la tabla padre. SQLite exige desactivar
        # temporalmente las FK aun cuando los IDs de las tablas hijas no cambian.
        fk_habilitadas = conexion.execute(text("PRAGMA foreign_keys")).scalar_one()
        conexion.commit()
        if fk_habilitadas:
            conexion.execute(text("PRAGMA foreign_keys = OFF"))
            conexion.commit()

        try:
            with conexion.begin():
                total_antes = conexion.execute(
                    text("SELECT COUNT(*) FROM equipos")
                ).scalar_one()

                if tiene_ubicacion:
                    # Las ubicaciones cortas pasan a ser sectores reales. El dato
                    # original también queda en equipos.ubicacion para auditoría.
                    conexion.execute(
                        text(
                            "INSERT OR IGNORE INTO sectores (nombre, descripcion, activo) "
                            "SELECT DISTINCT TRIM(ubicacion), "
                            "'Creado automáticamente desde la ubicación histórica de equipos.', 1 "
                            "FROM equipos "
                            "WHERE ubicacion IS NOT NULL "
                            "AND TRIM(ubicacion) <> '' "
                            "AND LENGTH(TRIM(ubicacion)) <= 60"
                        )
                    )

                condicion_sin_sector = []
                if tiene_ubicacion:
                    condicion_sin_sector.append(
                        "ubicacion IS NULL OR TRIM(ubicacion) = '' "
                        "OR LENGTH(TRIM(ubicacion)) > 60"
                    )
                else:
                    condicion_sin_sector.append("1 = 1")
                if tiene_sector_id:
                    condicion_sin_sector.append(
                        "sector_id IS NULL OR sector_id NOT IN (SELECT id FROM sectores)"
                    )

                necesita_transitorio = conexion.execute(
                    text(
                        "SELECT EXISTS(SELECT 1 FROM equipos WHERE "
                        + " OR ".join(f"({condicion})" for condicion in condicion_sin_sector)
                        + ")"
                    )
                ).scalar_one()
                if necesita_transitorio:
                    conexion.execute(
                        text(
                            "INSERT OR IGNORE INTO sectores (nombre, descripcion, activo) "
                            "VALUES (:nombre, :descripcion, 1)"
                        ),
                        {
                            "nombre": _SECTOR_SIN_ASIGNAR,
                            "descripcion": (
                                "Asignación transitoria para equipos migrados sin "
                                "una ubicación válida. Reasignar desde Gestión de equipos."
                            ),
                        },
                    )

                columnas_destino = [
                    "id",
                    "nombre",
                    "tipo",
                    "activo",
                    "frecuencia_calibracion_dias",
                ]
                expresiones_origen = [
                    "id",
                    "nombre",
                    "tipo",
                    "activo",
                    "frecuencia_calibracion_dias",
                ]
                if tiene_ubicacion:
                    columnas_destino.insert(3, "ubicacion")
                    # La columna legada admitía NULL; la nueva es NOT NULL.
                    expresiones_origen.insert(3, "COALESCE(ubicacion, '')")

                sectores_candidatos = []
                if tiene_sector_id:
                    sectores_candidatos.append(
                        "(SELECT id FROM sectores WHERE id = equipos.sector_id)"
                    )
                if tiene_ubicacion:
                    sectores_candidatos.append(
                        "(SELECT id FROM sectores "
                        "WHERE nombre = TRIM(equipos.ubicacion))"
                    )
                sectores_candidatos.append(
                    "(SELECT id FROM sectores WHERE nombre = :sector_sin_asignar)"
                )

                definicion_ubicacion = "ubicacion VARCHAR(100) NOT NULL, " if tiene_ubicacion else ""
                conexion.execute(
                    text(
                        "CREATE TABLE equipos_migracion_sector ("
                        "id INTEGER NOT NULL, "
                        "nombre VARCHAR(100) NOT NULL, "
                        "tipo VARCHAR(100) NOT NULL, "
                        + definicion_ubicacion
                        + "activo BOOLEAN NOT NULL, "
                        "frecuencia_calibracion_dias INTEGER, "
                        "sector_id INTEGER NOT NULL REFERENCES sectores(id), "
                        "PRIMARY KEY (id)"
                        ")"
                    )
                )
                conexion.execute(
                    text(
                        "INSERT INTO equipos_migracion_sector ("
                        + ", ".join(columnas_destino + ["sector_id"])
                        + ") SELECT "
                        + ", ".join(expresiones_origen)
                        + ", COALESCE("
                        + ", ".join(sectores_candidatos)
                        + ") FROM equipos"
                    ),
                    {"sector_sin_asignar": _SECTOR_SIN_ASIGNAR},
                )

                total_despues = conexion.execute(
                    text("SELECT COUNT(*) FROM equipos_migracion_sector")
                ).scalar_one()
                if total_despues != total_antes:
                    raise RuntimeError(
                        "La migración de equipos no conservó la cantidad de registros "
                        f"({total_antes} antes, {total_despues} después)."
                    )

                conexion.execute(text("DROP TABLE equipos"))
                conexion.execute(
                    text("ALTER TABLE equipos_migracion_sector RENAME TO equipos")
                )
                conexion.execute(
                    text("CREATE INDEX ix_equipos_nombre ON equipos (nombre)")
                )
                conexion.execute(
                    text("CREATE INDEX ix_equipos_sector_id ON equipos (sector_id)")
                )
        finally:
            if fk_habilitadas:
                conexion.execute(text("PRAGMA foreign_keys = ON"))
                conexion.commit()
