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
from .insumos_tipo import (
    migrar_aditivos_referencia,
    migrar_insumos_tipo,
    migrar_porcion_receta,
)
from .lotes import migrar_lotes
from .notificaciones import migrar_notificaciones
from .nutricion import migrar_nutricion
from .personal import bootstrap_super_admin, migrar_columnas_personal
from .seguridad import migrar_seguridad
from .stock import migrar_stock
from .tareas import migrar_tareas
from .trazabilidad import migrar_trazabilidad
from .vista_publica import migrar_vista_publica


def run_migrations() -> None:
    crear_bitacora()
    migrar_columnas_personal()
    migrar_documentos()
    migrar_incidentes()
    migrar_tareas()
    migrar_stock()
    migrar_lotes()
    migrar_trazabilidad()
    # E9: después de copiar los productos viejos (trazabilidad lee tipo='producto').
    migrar_aditivos_referencia()
    migrar_insumos_tipo()
    migrar_porcion_receta()
    # E11: parámetros de la tabla nutricional y base de composición de ejemplo.
    migrar_nutricion()
    migrar_equipos()
    # Necesita personal.es_super_admin, por eso va después de migrar_columnas_personal.
    bootstrap_super_admin()
    migrar_seguridad()
    migrar_notificaciones()
    # Vista pública: después de create_all (que ya creó la tabla) y de las
    # migraciones de estructura.
    migrar_vista_publica()


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()
