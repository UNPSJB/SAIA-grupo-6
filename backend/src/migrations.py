"""Migraciones ligeras para bases que ya existen.

`create_all()` crea las tablas faltantes pero NO agrega columnas a las que ya
existen. Sin esto, agregar un campo a un modelo (por ejemplo `es_super_admin`)
no se aplicaría sobre una base ya creada y la aplicación fallaría al consultar.
"""

import logging

from sqlalchemy import inspect, text

from src.database import engine
from src.models import ModeloBase

logger = logging.getLogger(__name__)


def _columnas_de(inspector, tabla: str) -> set:
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def run_migrations() -> None:
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())

    # 1) Rol de super admin
    if "personal" in tablas and "es_super_admin" not in _columnas_de(inspector, "personal"):
        logger.info("Migración: agregando columna personal.es_super_admin")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "ALTER TABLE personal "
                    "ADD COLUMN es_super_admin BOOLEAN NOT NULL DEFAULT 0"
                )
            )

    # 2) Bootstrap: si nadie es super admin, se promueve al administrador más
    #    antiguo. Si además no hay ningún administrador (base creada a mano o
    #    con puros operadores), se promueve al usuario activo más antiguo para
    #    que la instalación no quede sin quien pueda administrar los roles.
    with engine.begin() as conexion:
        total = conexion.execute(text("SELECT COUNT(*) FROM personal")).scalar_one()
        ya_hay_super = conexion.execute(
            text("SELECT COUNT(*) FROM personal WHERE es_super_admin = 1")
        ).scalar_one()
        ya_hay_admin = conexion.execute(
            text(
                "SELECT COUNT(*) FROM personal "
                "WHERE puede_administrar = 1 OR es_super_admin = 1"
            )
        ).scalar_one()

        if total > 0 and ya_hay_super == 0:
            if ya_hay_admin > 0:
                consulta = (
                    "SELECT id FROM personal "
                    "WHERE puede_administrar = 1 ORDER BY id LIMIT 1"
                )
                motivo = "no existía ningún super admin"
            else:
                consulta = (
                    "SELECT id FROM personal "
                    "WHERE activo = 1 ORDER BY id LIMIT 1"
                )
                motivo = "no existía ningún administrador en la base"

            candidato = conexion.execute(text(consulta)).scalar_one_or_none()

            if candidato is not None:
                conexion.execute(
                    text("UPDATE personal SET es_super_admin = 1 WHERE id = :id"),
                    {"id": candidato},
                )
                logger.warning(
                    "Bootstrap: el usuario %s fue promovido a super admin (%s).",
                    candidato,
                    motivo,
                )


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()