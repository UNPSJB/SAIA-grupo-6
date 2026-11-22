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
from .lotes_fecha_vencimiento import migrar_lotes_fecha_vencimiento
from .notificaciones import migrar_notificaciones
from .versiones_receta_vida_util import migrar_versiones_receta_vida_util
from .nutricion import migrar_nutricion
from .personal import bootstrap_super_admin, migrar_columnas_personal
from .rotulado_frontal import migrar_rotulado_frontal
from .reclamos import migrar_reclamos
from .retiros import migrar_retiros
from .reposiciones import migrar_reposiciones
from .seguridad import migrar_seguridad
from .stock import migrar_stock
from .tareas import migrar_tareas
from .trazabilidad import migrar_trazabilidad
from .unidades_medida_tipo_factor import (
    asignar_equivalencias_conocidas,
    migrar_unidades_medida_tipo_factor,
)
from .insumos_densidad_peso import migrar_insumos_densidad_peso
from .nutricion_conversion_en_insumo import migrar_conversion_a_insumo
from .vista_publica import migrar_vista_publica
from .rotulado import migrar_rotulado
from .declaraciones_rotulado import migrar_declaraciones_rotulado
from .clientes import migrar_clientes
from .salidas import migrar_salidas_despacho_entrega_cancelacion
from .salidas_recibido_por import migrar_salidas_recibido_por
from .salidas_momentos import migrar_salidas_momentos
from .salidas_rechazo import migrar_salidas_rechazo
from .transportistas import migrar_transportistas
from .certificaciones_transportista import (
    migrar_certificaciones_transportista,
    migrar_certificaciones_transportista_trazabilidad,
)
from .proveedores import migrar_proveedores
from .lotes_insumo_bajas import migrar_lotes_insumo_bajas


def run_migrations() -> None:
    crear_bitacora()
    migrar_columnas_personal()
    migrar_documentos()
    migrar_incidentes()
    migrar_tareas()
    migrar_stock()
    migrar_lotes()
    migrar_lotes_fecha_vencimiento()
    migrar_versiones_receta_vida_util()
    migrar_trazabilidad()
    migrar_aditivos_referencia()
    migrar_insumos_tipo()
    migrar_porcion_receta()
    # E11: parámetros de la tabla nutricional y base de composición de ejemplo.
    migrar_nutricion()
    # E12.1: depende de las columnas del perfil nutricional de E11.
    migrar_rotulado_frontal()
    migrar_equipos()
    bootstrap_super_admin()
    migrar_seguridad()
    migrar_notificaciones()
    migrar_unidades_medida_tipo_factor()
    asignar_equivalencias_conocidas()
    migrar_insumos_densidad_peso()
    # Después de las columnas del insumo: les copia la densidad y el peso del perfil.
    migrar_conversion_a_insumo()
    migrar_vista_publica()
    migrar_rotulado()
    migrar_declaraciones_rotulado()
    migrar_clientes()
    migrar_transportistas()
    migrar_certificaciones_transportista()
    migrar_certificaciones_transportista_trazabilidad()
    migrar_salidas_despacho_entrega_cancelacion()
    migrar_salidas_recibido_por()
    migrar_salidas_momentos()
    # Rechazos: después del resto de migraciones de salidas porque reconstruye
    # la tabla si el CHECK de estado todavía no admite RECHAZADA.
    migrar_salidas_rechazo()
    # Reclamos: al final, porque depende de salidas, lotes, clientes y de la
    # tabla clave-valor de configuración.
    migrar_reclamos()
    # Retiros: después de reclamos, salidas y lotes porque depende de ellos.
    migrar_retiros()
    # Reposiciones: depende de clientes, productos, salidas y retiros.
    migrar_reposiciones()
    migrar_proveedores()
    migrar_lotes_insumo_bajas()


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()