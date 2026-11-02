# Este paquete contiene SQL crudo específico de SQLite.
# Solo SQLite está soportado actualmente; no se implementa soporte multi-motor.
#
# Cada módulo migra un tema y es idempotente. `run_migrations` los llama en
# orden; el orden importa donde se indica.

import src.all_models  # noqa: F401  (registra todos los modelos)
from src.database import engine
from src.models import ModeloBase

from .base import crear_bitacora
from .documentos import migrar_documentos
from .equipos import migrar_equipos
from .incidentes import migrar_incidentes
from .notificaciones import migrar_notificaciones
from .personal import bootstrap_super_admin, migrar_columnas_personal
from .seguridad import migrar_seguridad
from .stock import migrar_stock
from .tareas import migrar_tareas


def run_migrations() -> None:
    crear_bitacora()
    migrar_columnas_personal()
    migrar_documentos()
    migrar_incidentes()
    migrar_tareas()
    migrar_stock()
    migrar_equipos()
    # Necesita personal.es_super_admin, por eso va después de migrar_columnas_personal.
    bootstrap_super_admin()
    migrar_seguridad()
    migrar_notificaciones()


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()
