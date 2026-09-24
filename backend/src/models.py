from sqlalchemy.orm import declarative_base

Base = declarative_base()


# autor original: https://stackoverflow.com/a/54034230
def keyvalgen(obj):
    """Genera pares nombre/valor, quitando/filtrando los atributos de SQLAlchemy."""
    excl = ("_sa_adapter", "_sa_instance_state")
    for k, v in vars(obj).items():
        if not k.startswith("_") and not any(hasattr(v, a) for a in excl):
            yield k, v


class ModeloBase(Base):
    """Modelo base para los módulos de nuestra app."""
    __abstract__ = True

    def __repr__(self):
        # Define un formato de representacion como cadena para el modelo base.
        params = ", ".join(f"{k}={v}" for k, v in keyvalgen(self))
        return f"{self.__class__.__name__}({params})"


# Nota: acá vivía `plan_limpieza_tareas`, la tabla intermedia de la relación
# muchos a muchos entre PlanLimpieza y Tarea. Se eliminó porque ahora cada
# Tarea pertenece a un único PlanLimpieza (relación 1-N / composición):
# ver Tarea.plan_limpieza_id en src/tareas/models.py.
