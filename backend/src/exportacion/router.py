"""Endpoints de exportación genérica de tablas a CSV/PDF.

Expone, para cada tabla registrada en `src.exportacion.configuracion`,
una descarga con el mismo formato que la bitácora de auditoría:

* `GET /exportacion/tablas` — lista las tablas disponibles y sus columnas.
* `GET /exportacion/{tabla}` — descarga la tabla en CSV o PDF.
* `GET /exportacion/{tabla}/columnas` — detalle de columnas de una tabla.

Los filtros se pasan como query params (uno por columna). Requieren sesión
de administrador, igual que la auditoría.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.exportacion.configuracion import (
    obtener,
    listar_tablas,
)
from src.exportacion.motor import exportar_csv, exportar_pdf

router = APIRouter(
    prefix="/exportacion",
    tags=["Exportación"],
    dependencies=[Depends(require_admin)],
)


@router.get("/tablas", response_model=list[dict[str, Any]])
def listar_tablas_exportables():
    """Lista todas las tablas que se pueden exportar, con sus columnas."""
    return listar_tablas()


@router.get("/{nombre_tabla}/columnas", response_model=list[dict[str, str]])
def columnas_tabla(
    nombre_tabla: str = Path(..., description="__tablename__ de la tabla a exportar."),
):
    """Devuelve las columnas (nombre y encabezado) de una tabla registrada."""
    try:
        config = obtener(nombre_tabla)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return [
        {"nombre": campo.nombre, "etiqueta": campo.etiqueta}
        for campo in config.campos
    ]


@router.get("/{nombre_tabla}")
def exportar_tabla(
    request: Request,
    nombre_tabla: str = Path(..., description="__tablename__ de la tabla a exportar."),
    formato: Literal["csv", "pdf"] = Query(
        "csv", description="csv | pdf."
    ),
    db: Session = Depends(get_db),
):
    """Descarga la tabla completa en CSV o PDF.

    Cualquier query param adicional que coincida con una columna de la tabla
    se aplica como filtro de igualdad (por ejemplo `?activo=true` o
    `?sector_id=3`).
    """
    try:
        config = obtener(nombre_tabla)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Construir filtros a partir de los query params que son columnas válidas.
    nombres_columnas = {campo.nombre for campo in config.campos}
    filtros = {
        nombre: valor
        for nombre, valor in request.query_params.items()
        if nombre in nombres_columnas
    }

    nombre_archivo = (
        f"{nombre_tabla}_{datetime.now():%Y%m%d_%H%M%S}.{formato}"
    )
    cabeceras = {
        "Content-Disposition": f'attachment; filename="{nombre_archivo}"'
    }

    if formato == "pdf":
        return Response(
            content=exportar_pdf(db, config, filtros),
            media_type="application/pdf",
            headers=cabeceras,
        )
    return Response(
        content="".join(exportar_csv(db, config, filtros)).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=cabeceras,
    )
