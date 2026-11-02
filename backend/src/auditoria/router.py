from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.auditoria import exportar, schemas, services
from src.auditoria.enriquecer import enriquecer_detalle_auditoria
from src.common.paginacion import ParamsPaginacion
from src.database import get_db
from src.personal.models import Personal

# La bitácora es de la persona con permiso de administrar: contiene el
# detalle de cada cambio de TODAS las entidades del sistema.
router = APIRouter(
    prefix="/auditoria",
    tags=["Auditoría"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=schemas.AuditLogPagina)
def listar_auditoria(
    entidad: Optional[str] = Query(
        None, max_length=60, description="Tabla auditada (su __tablename__)."
    ),
    entidad_id: Optional[str] = Query(
        None, max_length=40, description="PK de la fila auditada (compuesta: unida con '-')."
    ),
    usuario_id: Optional[int] = Query(None, ge=1, description="Quién hizo el cambio."),
    accion: Optional[schemas.AccionAuditoria] = Query(
        None, description="CREAR | MODIFICAR | BAJA | REACTIVAR | ELIMINAR."
    ),
    desde: Optional[date] = Query(None, description="Eventos desde ese día (inclusive)."),
    hasta: Optional[date] = Query(None, description="Eventos hasta ese día (inclusive)."),
    paginacion: ParamsPaginacion = Depends(),
    db: Session = Depends(get_db),
):
    """Bitácora de cambios de todas las entidades, siempre paginada."""
    items, total = services.listar_auditoria(
        db,
        entidad=entidad,
        entidad_id=entidad_id,
        usuario_id=usuario_id,
        accion=accion,
        desde=desde,
        hasta=hasta,
        page=paginacion.page,
        page_size=paginacion.page_size,
    )
    return schemas.AuditLogPagina(
        items=items,
        total=total,
        page=paginacion.page,
        page_size=paginacion.page_size,
    )


@router.get("/exportar")
def exportar_auditoria(
    formato: Literal["csv", "pdf"] = Query("csv", description="csv | pdf."),
    entidad: Optional[str] = Query(None, max_length=60),
    entidad_id: Optional[str] = Query(None, max_length=40),
    usuario_id: Optional[int] = Query(None, ge=1),
    accion: Optional[schemas.AccionAuditoria] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Descarga la bitácora completa (sin paginar) con los mismos filtros del listado."""
    items = services.iterar_auditoria(
        db,
        entidad=entidad,
        entidad_id=entidad_id,
        usuario_id=usuario_id,
        accion=accion,
        desde=desde,
        hasta=hasta,
    )
    nombre = f"auditoria_{datetime.now():%Y%m%d_%H%M%S}.{formato}"
    cabeceras = {"Content-Disposition": f'attachment; filename="{nombre}"'}

    if formato == "pdf":
        return Response(
            content=exportar.generar_pdf(items),
            media_type="application/pdf",
            headers=cabeceras,
        )
    return Response(
        content="".join(exportar.generar_csv(items)).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=cabeceras,
    )


@router.get("/entidades", response_model=list[str])
def listar_entidades(db: Session = Depends(get_db)):
    """Lista de entidades distintas presentes en la bitácora, para autocompletar filtros."""
    return services.listar_entidades(db)


@router.get("/{audit_id}", response_model=schemas.AuditLogDetalle)
def obtener_detalle_auditoria(
    audit_id: int = Path(..., description="ID del evento de auditoría."),
    db: Session = Depends(get_db),
):
    """Detalle de un evento de auditoría, con los cambios enriquecidos para
    mostrar nombres legibles de entidades relacionadas (nombres de equipos,
    personas, insumos, etc.) en vez de solo IDs."""
    fila = services.obtener_auditoria_por_id(db, audit_id)
    if fila is None:
        raise HTTPException(
            status_code=404, detail="Evento de auditoría no encontrado."
        )

    # Enriquecer con el nombre del actor
    usuario_nombre = None
    if fila.usuario_id is not None:
        persona = db.execute(
            select(Personal).where(Personal.id == fila.usuario_id)
        ).scalar_one_or_none()
        if persona is not None:
            usuario_nombre = " ".join(
                parte for parte in (persona.nombre, persona.apellido) if parte
            )

    extra = enriquecer_detalle_auditoria(db, fila)

    return schemas.AuditLogDetalle(
        id=fila.id,
        fecha=fila.fecha,
        usuario_id=fila.usuario_id,
        usuario_nombre=usuario_nombre,
        entidad=fila.entidad,
        entidad_id=fila.entidad_id,
        accion=fila.accion,
        cambios=extra["cambios_detalle"],
        registro=extra["registro"],
    )

