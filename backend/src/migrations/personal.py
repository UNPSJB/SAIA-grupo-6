import logging

from sqlalchemy import text

from src.database import engine

from .base import agregar_columna, marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)


def migrar_columnas_personal() -> None:
    if "personal" not in tablas():
        return
    agregar_columna("personal", "es_super_admin", "BOOLEAN NOT NULL DEFAULT 0")
    agregar_columna("personal", "debe_cambiar_password", "BOOLEAN NOT NULL DEFAULT 0")
    agregar_columna("personal", "password_changed_at", "DATETIME")


def bootstrap_super_admin() -> None:
    """Promueve al primer super admin, una sola vez.

    Antes corría en cada arranque: un super admin que se degradaba a
    propósito (para pasar el control) volvía a ser promovido en el
    siguiente reinicio, y degradar era imposible sin editar la base a mano.
    Ahora es de una sola vez, con bitácora en `schema_migrations`.
    """
    if migracion_ya_corrio("bootstrap_super_admin"):
        return

    promovido = None
    motivo = ""

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
                promovido = candidato

    if promovido is not None:
        marcar_migracion("bootstrap_super_admin")
        logger.warning(
            "Bootstrap: el usuario %s fue promovido a super admin (%s).",
            promovido,
            motivo,
        )
