from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class ModeloBase(DeclarativeBase):
    """Base declarativa de todos los modelos del dominio."""

    def __repr__(self) -> str:
        """Representación legible sin disparar cargas perezosas.

        Antes usaba `vars(obj)`, que fuerza el lazy-load de cada relación: un
        `logger.debug(f"{equipo}")` se convertía en una consulta por relación,
        en un contexto que no espera I/O y con la sesión ya cerrada.

        `inspect(obj).attrs` entrega los atributos mapeados sin tocar las
        relaciones, así que el repr es barato y no puede fallar.
        """
        estado = inspect(self)
        partes = []
        for atributo in estado.mapper.column_attrs:
            partes.append(f"{atributo.key}={getattr(self, atributo.key, None)!r}")
        return f"{type(self).__name__}({', '.join(partes)})"


# Alias conservado por compatibilidad con los módulos que lo importan.
Base = ModeloBase


# Nota: acá vivía `plan_limpieza_tareas`, la tabla intermedia de la relación
# muchos a muchos entre PlanLimpieza y Tarea. Se eliminó porque ahora cada
# Tarea pertenece a un único PlanLimpieza (relación 1-N / composición):
# ver Tarea.plan_limpieza_id en src/tareas/models.py.
