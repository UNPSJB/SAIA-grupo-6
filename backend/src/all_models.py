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
from src.sector.models import Sector
from src.Equipo.models import Calibracion, Equipo  # noqa: F401
from src.insumos.models import Insumo  # noqa: F401
from src.proveedores.models import Proveedor  # noqa: F401
from src.lotes.models import InsumoLote, LoteProduccion  # noqa: F401
from src.insumoQuimico.models import InsumoQuimico, LoteStock  # noqa: F401
from src.elementoLimpieza.models import ElementoLimpieza  # noqa: F401
from src.PlanLimpieza.models import PlanLimpieza  # noqa: F401
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento  # noqa: F401
from src.tareas.models import Tarea  # noqa: F401
from src.checklist.models import Checklist, HistorialRegistroTarea, RegistroTarea  # noqa: F401
from src.incidente.models import Incidente, HistorialIncidente  # noqa: F401
from src.auth.models import TokenRevocado  # noqa: F401
from src.documentos.models import Documento, VersionDocumento  # noqa: F401

# Bitácora de auditoría: va al final a propósito. Los listeners se registran
# sobre `ModeloBase` con `propagate=True` y el modelo ya tiene que estar
# mapeado para poder insertar en su tabla desde los eventos del ORM.
from src.auditoria.models import AuditLog  # noqa: F401
import src.auditoria.listeners  # noqa: F401

__all__ = [
    "Aptitud",
    "AuditLog",
    "Calibracion",
    "Checklist",
    "Documento",
    "ElementoLimpieza",
    "Sector",
    "Equipo",
    "HistorialRegistroTarea",
    "Incidente",
    "HistorialIncidente",
    "Insumo",
    "InsumoLote",
    "InsumoQuimico",
    "LoteProduccion",
    "LoteStock",
    "Personal",
    "PlanCalibracionMantenimiento",
    "PlanLimpieza",
    "Proveedor",
    "RegistroTarea",
    "Tarea",
    "TokenRevocado",
    "UnidadMedida",
    "VencimientoPersonal",
    "VersionDocumento",
]
