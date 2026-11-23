"""Consultas de apoyo sobre el personal usadas por la lógica de arranque
(bootstrap) y por la pantalla de registro.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.personal.models import Personal


# El arranque mira la empresa entera, no la sede activa: con que haya un
# administrador en cualquier sede, el sistema ya está gobernado.
_TODAS = {"todos_los_establecimientos": True}


def contar_personas(db: Session) -> int:
    return db.scalar(select(func.count(Personal.id)).execution_options(**_TODAS)) or 0


def hay_administradores(db: Session) -> bool:
    """True si existe al menos una persona con poder de administración.

    Cuenta como administrador a quien tenga `puede_administrar` o
    `es_super_admin`. Sirve para decidir si el sistema ya está "gobernado":
    mientras no haya ninguno, el registro público puede crear al primer
    super admin.
    """
    cantidad = db.scalar(
        select(func.count(Personal.id)).where(
            or_(
                Personal.puede_administrar.is_(True),
                Personal.es_super_admin.is_(True),
            )
        ).execution_options(**_TODAS)
    )

    return (cantidad or 0) > 0