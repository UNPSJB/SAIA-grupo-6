"""Registro de tablas exportables.

El motor de exportación (`motor.py`) es genérico: no sabe nada de tablas
concretas. Toda la información específica de cada tabla vive acá, en
`REGISTRO_TABLAS`, claveada por `__tablename__`.

Para agregar una tabla nueva solo hay que añadir una entrada a este registro
(ver `ConfigTabla` y `CampoExport` más abajo). No hay que tocar el motor ni
el router.

Convenciones:
* `nombre_tabla` debe coincidir con `Modelo.__tablename__`.
* `campos` lista las columnas a exportar, en el orden que se quieren ver.
* `pk` es la columna clave primaria (para el encabezado "ID" y orden estable).
* `orden_por` es la columna por la que se ordena por defecto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from src.models import ModeloBase


@dataclass
class CampoExport:
    """Una columna a exportar de una tabla."""

    nombre: str          # nombre del atributo en el modelo SQLAlchemy
    etiqueta: str        # encabezado que se muestra en CSV/PDF
    formato: str = "texto"  # texto | fecha | booleano | dinero
    ancho_pdf: int | None = None  # ancho en mm para el PDF (None = automático)


@dataclass
class ConfigTabla:
    """Configuración de exportación de una tabla del dominio."""

    modelo: type[ModeloBase]
    nombre_tabla: str
    etiqueta: str
    campos: list[CampoExport]
    pk: str = "id"
    orden_por: str = "id"


# ---------------------------------------------------------------------------
# Registro: nombre_tabla -> ConfigTabla
# ---------------------------------------------------------------------------
# Nota: los modelos se importan perezosamente dentro de cada entrada para no
# forzar un orden de importación estricto. `src.all_models` ya se encarga de
# registrar todas las clases en el registro de SQLAlchemy al arrancar la app.
REGISTRO_TABLAS: dict[str, ConfigTabla] = {}


def registrar(config: ConfigTabla) -> ConfigTabla:
    """Registra una configuración de tabla y la devuelve (para usarlo como
    decorador o llamada directa)."""
    REGISTRO_TABLAS[config.nombre_tabla] = config
    return config


def obtener(nombre_tabla: str) -> ConfigTabla:
    """Devuelve la configuración de una tabla o lanza KeyError si no existe."""
    if nombre_tabla not in REGISTRO_TABLAS:
        raise KeyError(
            f"Tabla '{nombre_tabla}' no está registrada para exportación. "
            f"Tablas disponibles: {sorted(REGISTRO_TABLAS)}"
        )
    return REGISTRO_TABLAS[nombre_tabla]


def listar_tablas() -> list[dict[str, Any]]:
    """Devuelve una lista ligera con metadatos de todas las tablas registradas."""
    return [
        {
            "nombre_tabla": cfg.nombre_tabla,
            "etiqueta": cfg.etiqueta,
            "columnas": [c.nombre for c in cfg.campos],
            "encabezados": [c.etiqueta for c in cfg.campos],
            "pk": cfg.pk,
        }
        for cfg in REGISTRO_TABLAS.values()
    ]
