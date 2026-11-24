"""Endpoints de exportación genérica de tablas a CSV/PDF.

Expone, para cada tabla registrada en `src.exportacion.configuracion`,
una descarga con el mismo formato que la bitácora de auditoría:

* `GET /exportacion/tablas` — lista las tablas disponibles y sus columnas.
* `GET /exportacion/{tabla}` — descarga la tabla en CSV o PDF.
* `GET /exportacion/{tabla}/columnas` — detalle de columnas de una tabla.
* `GET /exportacion/vistas/...` — vistas calculadas (ver `vistas.py`).
* `POST /exportacion/filas` — da formato a una tabla que arma el frontend.

Los filtros se pasan como query params (uno por columna). Requieren sesión
de administrador, igual que la auditoría.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError, model_validator
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.exportacion.configuracion import (
    obtener,
    listar_tablas,
)
from src.exportacion import vistas
from src.exportacion.formato import generar_csv
from src.exportacion.listados import FiltrosListado
from src.exportacion.motor import exportar_csv, exportar_pdf, pdf_desde_filas
from src.insumoQuimico.models import TipoMovimientoStock
from src.personal.models import Personal
from src.pyme.pdf import cabecera_desde_db

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


def _descarga(
    vista: vistas.Vista,
    formato: str,
    nombre: str,
    db: Session,
    usuario: Personal,
) -> Response:
    """Respuesta de descarga (CSV o PDF) para una vista ya armada."""
    titulo, encabezados, filas = vista
    nombre_archivo = f"{nombre}_{datetime.now():%Y%m%d_%H%M%S}.{formato}"
    cabeceras = {"Content-Disposition": f'attachment; filename="{nombre_archivo}"'}
    if formato == "pdf":
        return Response(
            content=pdf_desde_filas(
                titulo,
                encabezados,
                filas,
                cabecera=cabecera_desde_db(db),
                usuario=usuario,
            ),
            media_type="application/pdf",
            headers=cabeceras,
        )
    return Response(
        content="".join(generar_csv(filas, encabezados)).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=cabeceras,
    )


FormatoExportacion = Literal["csv", "pdf"]


@router.get("/vistas/vencimientos")
def exportar_vista_vencimientos(
    formato: FormatoExportacion = "csv",
    tipo: Optional[Literal["PERSONAL", "CALIBRACION", "MANTENIMIENTO", "DOCUMENTO"]] = None,
    persona_id: Optional[int] = None,
    aptitud: Optional[str] = None,
    estado: Optional[Literal["VENCIDO", "PROXIMO", "VIGENTE"]] = None,
    buscar: Optional[str] = Query(None, max_length=100),
    orden: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Vencimientos consolidados, con los mismos filtros que la tabla."""
    vista = vistas.vencimientos(db, tipo, persona_id, aptitud, estado, buscar, orden)
    return _descarga(vista, formato, "vencimientos", db, usuario)


@router.get("/vistas/stock-actual")
def exportar_vista_stock_actual(
    formato: FormatoExportacion = "csv",
    buscar: Optional[str] = Query(None, max_length=100),
    stock_bajo: Optional[bool] = None,
    orden: str = "nombre_asc",
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    vista = vistas.stock_actual(db, buscar, stock_bajo, orden)
    return _descarga(vista, formato, "stock_actual", db, usuario)


@router.get("/vistas/stock-movimientos")
def exportar_vista_stock_movimientos(
    formato: FormatoExportacion = "csv",
    insumo_quimico_id: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[TipoMovimientoStock] = None,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    vista = vistas.stock_movimientos(db, insumo_quimico_id, fecha_desde, fecha_hasta, tipo)
    return _descarga(vista, formato, "stock_movimientos", db, usuario)


@router.get("/vistas/stock-lotes")
def exportar_vista_stock_lotes(
    formato: FormatoExportacion = "csv",
    proveedor_id: Optional[int] = None,
    insumo_quimico_id: Optional[int] = None,
    numero_lote: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    vista = vistas.stock_lotes(db, proveedor_id, insumo_quimico_id, numero_lote)
    return _descarga(vista, formato, "stock_lotes", db, usuario)


@router.get("/vistas/stock-consumo")
def exportar_vista_stock_consumo(
    fecha_desde: date,
    fecha_hasta: date,
    formato: FormatoExportacion = "csv",
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    vista = vistas.stock_consumo(db, fecha_desde, fecha_hasta)
    return _descarga(vista, formato, "stock_consumo", db, usuario)

# --- Producción ------------------------------------------------------------
# Mismos filtros que cada listado; `buscar` replica la búsqueda de texto que
# la pantalla hace en el navegador.


@router.get("/vistas/lotes-produccion")
def exportar_vista_lotes_produccion(
    formato: FormatoExportacion = "csv",
    producto_id: Optional[int] = Query(None, ge=1),
    estado: Optional[Literal["en_proceso", "terminado", "cancelado"]] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    vista = vistas.lotes_produccion(db, producto_id, estado, fecha_desde, fecha_hasta, buscar)
    return _descarga(vista, formato, "lotes_produccion", db, usuario)


@router.get("/vistas/salidas")
def exportar_vista_salidas(
    formato: FormatoExportacion = "csv",
    estado: Optional[Literal["RESERVADO", "DESPACHADO", "ENTREGADO", "CANCELADO", "RECHAZADA"]] = None,
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(
        vistas.salidas_producto(db, estado, buscar), formato, "salidas", db, usuario
    )


@router.get("/vistas/retiros")
def exportar_vista_retiros(
    formato: FormatoExportacion = "csv",
    estado: Optional[Literal["EN_CURSO", "CERRADO"]] = None,
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(
        vistas.retiros_lotes(db, estado, buscar), formato, "retiros", db, usuario
    )


@router.get("/vistas/recetas")
def exportar_vista_recetas(
    formato: FormatoExportacion = "csv",
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(vistas.recetas(db, buscar), formato, "recetas", db, usuario)


@router.get("/vistas/productos")
def exportar_vista_productos(
    formato: FormatoExportacion = "csv",
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(
        vistas.productos(db, incluir_inactivos, buscar), formato, "productos", db, usuario
    )


@router.get("/vistas/clientes")
def exportar_vista_clientes(
    formato: FormatoExportacion = "csv",
    solo_inactivos: bool = False,
    buscar: Optional[str] = Query(None, max_length=100),
    orden: str = "nombre_asc",
    db: Session = Depends(get_db),
):
    return _descarga(vistas.clientes(db, solo_inactivos, buscar, orden), formato, "clientes")


@router.get("/vistas/transportistas")
def exportar_vista_transportistas(
    formato: FormatoExportacion = "csv",
    solo_inactivos: bool = False,
    buscar: Optional[str] = Query(None, max_length=100),
    orden: str = "razon_social_asc",
    db: Session = Depends(get_db),
):
    vista = vistas.transportistas(db, solo_inactivos, buscar, orden)
    return _descarga(vista, formato, "transportistas")


@router.get("/vistas/alimentos")
def exportar_vista_alimentos(
    formato: FormatoExportacion = "csv",
    buscar: Optional[str] = Query(None, max_length=100),
    base: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(
        vistas.alimentos_referencia(db, buscar, base), formato, "alimentos", db, usuario
    )


@router.get("/vistas/rotulado")
def exportar_vista_rotulado(
    formato: FormatoExportacion = "csv",
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return _descarga(
        vistas.rotulado_productos(db, buscar), formato, "rotulado", db, usuario
    )


class FilasExportacion(BaseModel):
    """Tabla ya armada por el frontend, tal como se ve en pantalla.

    Para las tablas que no tienen una vista propia acá (stock de insumos,
    aditivos, reclamos...): el frontend manda las filas filtradas que muestra
    y el servidor solo les da el formato de siempre (mismo CSV y mismo PDF que
    el resto de las exportaciones). No se consulta la base: se devuelve lo que
    el usuario ya tiene en pantalla, así que no expone datos nuevos.
    """

    titulo: str = Field(..., min_length=1, max_length=120)
    nombre: str = Field(..., min_length=1, max_length=60, pattern=r"^[a-z0-9_-]+$")
    encabezados: list[Annotated[str, Field(max_length=80)]] = Field(..., min_length=1, max_length=30)
    filas: list[list[Annotated[str, Field(max_length=2000)]]] = Field(..., max_length=20000)

    @model_validator(mode="after")
    def _filas_del_ancho_de_los_encabezados(self) -> "FilasExportacion":
        ancho = len(self.encabezados)
        if any(len(fila) != ancho for fila in self.filas):
            raise ValueError("Cada fila debe tener una celda por encabezado.")
        return self


@router.post("/filas")
def exportar_filas(datos: FilasExportacion, formato: FormatoExportacion = "csv"):
    """Da formato CSV o PDF a una tabla armada en el frontend."""
    return _descarga((datos.titulo, datos.encabezados, datos.filas), formato, datos.nombre)


@router.get("/{nombre_tabla}")
def exportar_tabla(
    request: Request,
    nombre_tabla: str = Path(..., description="__tablename__ de la tabla a exportar."),
    formato: Literal["csv", "pdf"] = Query(
        "csv", description="csv | pdf."
    ),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Descarga la tabla completa en CSV o PDF.

    Las tablas con pantalla propia aceptan los mismos filtros que su listado
    (`buscar`, `orden`, `activo`...: ver `FiltrosListado`). En el resto, un
    query param que coincida con una columna se aplica como filtro de igualdad.
    """
    try:
        config = obtener(nombre_tabla)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if config.listar is not None:
        admitidos = set(FiltrosListado.model_fields)
    else:
        admitidos = {campo.nombre for campo in config.campos}
    filtros = {
        nombre: valor
        for nombre, valor in request.query_params.items()
        if nombre in admitidos and valor != ""
    }
    if config.listar is not None:
        try:
            FiltrosListado.model_validate(filtros)
        except ValidationError as exc:
            raise HTTPException(
                status_code=422, detail="Algún filtro de la exportación no es válido."
            ) from exc

    nombre_archivo = (
        f"{nombre_tabla}_{datetime.now():%Y%m%d_%H%M%S}.{formato}"
    )
    cabeceras = {
        "Content-Disposition": f'attachment; filename="{nombre_archivo}"'
    }

    if formato == "pdf":
        return Response(
            content=exportar_pdf(
                db,
                config,
                filtros,
                cabecera=cabecera_desde_db(db),
                usuario=usuario,
            ),
            media_type="application/pdf",
            headers=cabeceras,
        )
    return Response(
        content="".join(exportar_csv(db, config, filtros)).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=cabeceras,
    )
