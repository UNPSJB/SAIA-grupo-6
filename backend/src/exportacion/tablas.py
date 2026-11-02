"""Registro concreto de tablas del dominio para exportación.

Aquí se importa cada modelo y se registra su configuración de exportación.
El motor (`motor.py`) no conoce tablas específicas: solo lee `REGISTRO_TABLAS`
(llenado al importar este módulo desde `configuracion`).

Para agregar una tabla nueva:
1. Importá el modelo al inicio de este archivo.
2. Agregá una entrada a `TABLAS_DOMINIO` con `(modelo, nombre_tabla, etiqueta)`.
   Las columnas se descubren automáticamente con SQLAlchemy `inspect`.
3. Opcionalmente, pasá `exclude` (columnas a omitir, ej. contraseñas),
   `column_order` (orden personalizado) o `headers` (encabezados a medida).

Este módulo debe importarse antes de usar los endpoints de exportación
(ver `src/main.py`).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import inspect

from src.all_models import (  # noqa: F401  (garantiza que los modelos estén mapeados)
    Aptitud,
    AuditLog,
    Calibracion,
    Checklist,
    ConfiguracionVistaPublica,
    Documento,
    ElementoLimpieza,
    EstadoNotificaciones,
    Equipo,
    HistorialIncidente,
    HistorialRegistroTarea,
    Incidente,
    IndicadorVistaPublica,
    Insumo,
    InsumoQuimico,
    LoteStock,
    NotificacionPersistida,
    Personal,
    PlanCalibracionMantenimiento,
    PlanLimpieza,
    Proveedor,
    RegistroTarea,
    Sector,
    Tarea,
    TokenRevocado,
    UnidadMedida,
    VencimientoPersonal,
    VersionDocumento,
)
from src.exportacion.configuracion import CampoExport, ConfigTabla, registrar

# ---------------------------------------------------------------------------
# Columnas sensibles que nunca se exportan (coincide con AUDITORIA_REDACTAR
# y con campos internos del sistema).
# ---------------------------------------------------------------------------
EXCLUIR_SIEMPRE = {"password", "password_hash", "token", "refresh_token"}


def _descubrir_columnas(modelo: type, exclude: set[str] | None = None) -> list[str]:
    """Devuelve los nombres de las columnas mapeadas de un modelo, sin
    disparar cargas perezosas ni incluir relaciones ni columnas sensibles."""
    exclude = exclude or set()
    nombres = []
    for atributo in inspect(modelo).mapper.column_attrs:
        nombre = atributo.key
        if nombre in EXCLUIR_SIEMPRE or nombre in exclude:
            continue
        nombres.append(nombre)
    return nombres


def _encabezado(nombre_columna: str) -> str:
    """Convierte un nombre de columna de snake_case a una etiqueta legible."""
    replacements = {
        "id": "ID",
        "dni": "DNI",
        "email": "E-mail",
        "url": "URL",
        "pdf": "PDF",
    }
    if nombre_columna in replacements:
        return replacements[nombre_columna]
    return nombre_columna.replace("_", " ").title()


# ---------------------------------------------------------------------------
# Definición de tablas a exportar.
#
# Cada entrada: (modelo_clase, nombre_tabla, etiqueta, opciones)
#   opciones.exclude:      set de columnas a omitir
#   opciones.column_order: lista con el orden deseado (el resto se anexa)
#   opciones.headers:      dict {nombre_columna: encabezado_personalizado}
# ---------------------------------------------------------------------------
@dataclass
class OpcionesTabla:
    exclude: set[str] = field(default_factory=set)
    column_order: list[str] | None = None
    headers: dict[str, str] = field(default_factory=dict)


TABLAS_DOMINIO: list[tuple[type, str, str, OpcionesTabla]] = [
    (Personal, "personal", "Personal", OpcionesTabla(
        exclude={"password", "password_changed_at"},
        column_order=[
            "id", "dni", "nombre", "apellido", "email", "telefono",
            "activo", "puede_operar", "puede_administrar", "es_super_admin",
            "debe_cambiar_password", "fecha_creacion", "fecha_actualizacion",
        ],
        headers={"fecha_creacion": "Fecha Alta", "fecha_actualizacion": "Fecha Actualización"},
    )),
    (UnidadMedida, "unidades_medida", "Unidades de medida"),
    (Aptitud, "aptituds", "Aptitudes"),
    (VencimientoPersonal, "vencimientos_personal", "Vencimientos personal"),
    (Sector, "sectores", "Sectores"),
    (Equipo, "equipos", "Equipos", OpcionesTabla(
        column_order=["id", "nombre", "tipo", "sector_id", "activo", "frecuencia_calibracion_dias"],
    )),
    (Calibracion, "calibraciones", "Calibraciones", OpcionesTabla(
        column_order=["id", "equipo_id", "fecha_realizacion", "proximo_vencimiento", "tipo", "activo", "certificado_url"],
    )),
    (Insumo, "insumos", "Insumos", OpcionesTabla(
        column_order=["id", "nombre", "unidad_medida_id", "activo"],
    )),
    (Proveedor, "proveedores", "Proveedores", OpcionesTabla(
        column_order=["id", "nombre", "matricula", "activo"],
    )),
    (InsumoQuimico, "insumos_quimicos", "Insumos químicos"),
    (LoteStock, "lotes_stock", "Lotes de stock"),
    (ElementoLimpieza, "elementos_limpieza", "Elementos de limpieza"),
    (PlanLimpieza, "planes_limpieza", "Planes de limpieza"),
    (PlanCalibracionMantenimiento, "planes_calibracion_mantenimiento", "Planes calibración/mantenimiento"),
    (Tarea, "tareas", "Tareas"),
    (Checklist, "checklists", "Checklists"),
    (RegistroTarea, "registros_tarea", "Registros de tarea"),
    (HistorialRegistroTarea, "historial_registros_tarea", "Historial registros de tarea"),
    (Incidente, "incidentes", "Incidentes"),
    (HistorialIncidente, "historial_incidentes", "Historial incidentes"),
    (Documento, "documentos", "Documentos"),
    (VersionDocumento, "versiones_documento", "Versiones de documento"),
    (ConfiguracionVistaPublica, "configuracion_vista_publica", "Configuración vista pública"),
    (IndicadorVistaPublica, "indicadores_vista_publica", "Indicadores vista pública"),
    (NotificacionPersistida, "notificaciones_persistidas", "Notificaciones persistidas"),
    (EstadoNotificaciones, "estados_notificaciones", "Estados de notificaciones"),
    (TokenRevocado, "tokens_revocados", "Tokens revocados"),
    (AuditLog, "audit_log", "Bitácora de auditoría"),
]


def _registrar_todas() -> None:
    """Construye y registra la configuración de cada tabla definida."""
    for entrada in TABLAS_DOMINIO:
        if len(entrada) == 4:
            modelo, nombre_tabla, etiqueta, opts = entrada
        else:
            modelo, nombre_tabla, etiqueta = entrada
            opts = OpcionesTabla()
        columnas = _descubrir_columnas(modelo, exclude=opts.exclude)

        # Aplicar orden personalizado si se indicó; el resto se anexa al final.
        if opts.column_order:
            ordenadas = [c for c in opts.column_order if c in columnas]
            restantes = [c for c in columnas if c not in opts.column_order]
            columnas = ordenadas + restantes

        campos = [
            CampoExport(
                nombre=nombre,
                etiqueta=opts.headers.get(nombre, _encabezado(nombre)),
            )
            for nombre in columnas
        ]

        registrar(
            ConfigTabla(
                modelo=modelo,
                nombre_tabla=nombre_tabla,
                etiqueta=etiqueta,
                campos=campos,
                pk="id",
                orden_por="id",
            )
        )


# Ejecutar el registro al importar este módulo.
_registrar_todas()
