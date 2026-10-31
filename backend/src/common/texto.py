"""Normalización de texto para búsquedas y orden (minúsculas, sin tildes)."""

import unicodedata
from typing import Any, Sequence

from sqlalchemy import event, func
from sqlalchemy.engine import Engine

NOMBRE_FUNCION_SQL = "sin_tildes"


def normalizar_texto(texto: str) -> str:
    """Minúsculas y sin tildes."""
    descompuesto = unicodedata.normalize("NFD", texto)
    sin_marcas = "".join(
        caracter
        for caracter in descompuesto
        if unicodedata.category(caracter) != "Mn"
    )
    return sin_marcas.lower()


def escapar_like(valor: str) -> str:
    """Escapa `%` y `_` para que LIKE los trate como texto."""
    return (
        valor.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def patron_contiene(valor: str) -> str:
    return f"%{escapar_like(normalizar_texto(valor))}%"


def comparar_texto(columna: Any, valor: str) -> Any:
    """Igualdad insensible a mayúsculas. No ignora tildes (José ≠ Jose)."""
    return columna.ilike(escapar_like(valor), escape="\\")


def sin_tildes(columna: Any) -> Any:
    return func.sin_tildes(columna)


def contiene_texto(columna: Any, valor: str) -> Any:
    """LIKE insensible a mayúsculas y tildes."""
    return sin_tildes(columna).like(patron_contiene(valor), escape="\\")


def coincide_terminos(campos: Sequence[str | None], texto: str | None) -> bool:
    """True si cada palabra aparece en algún campo. Sin texto no filtra."""
    terminos = normalizar_texto(texto or "").split()
    if not terminos:
        return True

    contenido = normalizar_texto(" ".join(campo or "" for campo in campos))
    return all(termino in contenido for termino in terminos)


def _sin_tildes_sql(valor: Any) -> str | None:
    if valor is None:
        return None
    return normalizar_texto(str(valor))


@event.listens_for(Engine, "connect")
def _registrar_sin_tildes(dbapi_conexion: Any, _conexion_record: Any) -> None:
    """Registra `sin_tildes` en cada conexión SQLite."""
    if not hasattr(dbapi_conexion, "create_function"):
        return

    dbapi_conexion.create_function(
        NOMBRE_FUNCION_SQL,
        1,
        _sin_tildes_sql,
        deterministic=True,
    )
