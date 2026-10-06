"""Importa todos los modelos del dominio en un orden seguro.

Existe por una razón concreta. Varias relaciones son bidireccionales
(`back_populates`), así que hay pares de módulos que se referencian mutuamente:

    Equipo  <->  PlanLimpieza
    Equipo  <->  PlanCalibracionMantenimiento
    PlanLimpieza  <->  Tarea

En esos pares, el módulo "de arriba" no puede importar al de "abajo" (sería un
ciclo), así que SQLAlchemy resuelve el nombre desde su registro de clases. Y el
registro solo conoce una clase si algún módulo ya la importó.

El resultado antes de este archivo: `create_all()` y `configure_mappers()`
funcionaban solo porque `src/main.py` importaba los 14 módulos de modelos en
determinado orden. Importar `src.checklist.models` en aislamiento —un test, un
script de migración, un worker— fallaba con `KeyError: 'Equipo'`.

Importar este módulo garantiza que el registro esté completo, sin importar el
orden. Cualquier punto de entrada que necesite todos los modelos (la app, los
tests, `crear_tablas_y_migrar`) debe pasar por acá.

Uso:
    import src.all_models  # noqa: F401
    from sqlalchemy.orm import configure_mappers
    configure_mappers()
"""

# Orden sin dependencias entre sí: primero las hojas, después las que las usan.
from src.personal.models import Personal  # noqa: F401
from src.unidadMedida.models import UnidadMedida  # noqa: F401
from src.aptitud.models import Aptitud  # noqa: F401
from src.vencimientoPersonal.models import VencimientoPersonal  # noqa: F401
from src.Equipo.models import Equipo  # noqa: F401
from src.insumos.models import Insumo  # noqa: F401
from src.insumoQuimico.models import InsumoQuimico  # noqa: F401
from src.elementoLimpieza.models import ElementoLimpieza  # noqa: F401
from src.PlanLimpieza.models import PlanLimpieza  # noqa: F401
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento  # noqa: F401
from src.tareas.models import Tarea  # noqa: F401
from src.checklist.models import Checklist, HistorialRegistroTarea, RegistroTarea  # noqa: F401
from src.incidente.models import Incidente  # noqa: F401
from src.auth.models import TokenRevocado  # noqa: F401

__all__ = [
    "Aptitud",
    "Checklist",
    "ElementoLimpieza",
    "Equipo",
    "HistorialRegistroTarea",
    "Incidente",
    "Insumo",
    "InsumoQuimico",
    "Personal",
    "PlanCalibracionMantenimiento",
    "PlanLimpieza",
    "RegistroTarea",
    "Tarea",
    "TokenRevocado",
    "UnidadMedida",
    "VencimientoPersonal",
]