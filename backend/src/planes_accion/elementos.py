"""Nombre para mostrar de un elemento del motor de riesgos.

El motor identifica cada elemento con una clave interna ("equipo:3",
"persona:12"). Esa clave no significa nada para quien usa la aplicación: acá se
traduce al nombre de la cosa concreta.
"""

from __future__ import annotations

from typing import Callable

from sqlalchemy.orm import Session

from src.Equipo.models import Equipo
from src.documentos.models import Documento
from src.elementoLimpieza.models import ElementoLimpieza
from src.insumoQuimico.models import InsumoQuimico
from src.insumos.models import Insumo
from src.lotesInsumo.models import LoteInsumo
from src.notificaciones import riesgo
from src.personal.models import Personal
from src.productos.models import Producto

#: Prefijo de la clave -> (modelo, cómo se nombra, texto si ya no existe).
_ENTIDADES: dict[str, tuple[type, Callable[..., str], str]] = {
    "equipo": (Equipo, lambda e: e.nombre, "Equipo"),
    "elemento": (ElementoLimpieza, lambda e: e.nombre, "Elemento de limpieza"),
    "documento": (Documento, lambda d: d.nombre, "Documento"),
    "persona": (Personal, lambda p: f"{p.nombre} {p.apellido or ''}".strip(), "Persona"),
    "lote-insumo": (LoteInsumo, lambda lote: f"Lote {lote.numero_lote}", "Lote de insumo"),
    "homologacion-insumo": (Insumo, lambda i: i.marca, "Insumo"),
    "STOCK_BAJO": (InsumoQuimico, lambda i: i.nombre, "Insumo químico"),
    # Reclamos, retiros y rechazos: cuentan sobre el producto afectado.
    "producto": (Producto, lambda p: p.nombre, "Producto"),
}


def nombre_elemento(db: Session, clave: str) -> str:
    """Cómo se llama el elemento `clave` ("equipo:3" -> "Freidora 16")."""
    prefijo, _, resto = clave.partition(":")

    if prefijo == "incidente-tipo":
        tipo = riesgo.TIPOS_SITUACION.get(resto.upper())
        return f"{tipo.etiqueta if tipo else 'Incidentes'} (sin equipo)"

    if prefijo in _ENTIDADES:
        modelo, nombrar, generico = _ENTIDADES[prefijo]
        fila = db.get(modelo, int(resto)) if resto.isdigit() else None
        return nombrar(fila) if fila is not None else f"{generico} #{resto}"

    return "Otro elemento"
