from typing import Literal, Optional, Union

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.personal.models import Personal
from src.planes_accion import schemas, services
from src.planes_accion.constants import EstadoPlan

# Cualquier usuario autorizado (operar o administrar) puede crear y tratar
# planes. La configuración del período de observación es solo de administración.
router = APIRouter(prefix="/planes-accion", tags=["Planes de acción"])

_OPERADOR = [Depends(require_operador)]
_ADMIN = [Depends(require_admin)]

GrupoPlan = Literal["activos", "finalizados"]


# ----------------------------------------------------------------------
# Rutas fijas: van ANTES de "/{plan_id}" para que no se confundan con un id.
# ----------------------------------------------------------------------

@router.get(
    "/situaciones-disponibles",
    response_model=list[schemas.SituacionDisponible],
    dependencies=_OPERADOR,
)
def listar_situaciones_disponibles(
    tipo: Optional[str] = Query(None, description="Solo las de este tipo de situación."),
    db: Session = Depends(get_db),
):
    """Situaciones presentes que se pueden tratar con un plan nuevo (las que no
    están en otro plan activo). Las que SAIA sugiere tratar vienen primero."""
    return services.situaciones_disponibles(db, tipo)


@router.get(
    "/situaciones-con-plan",
    response_model=list[schemas.SituacionConPlan],
    dependencies=_OPERADOR,
)
def listar_situaciones_con_plan(db: Session = Depends(get_db)):
    return services.situaciones_con_plan(db)


@router.get(
    "/responsables",
    response_model=list[schemas.ResponsablePosible],
    dependencies=_OPERADOR,
)
def listar_responsables(db: Session = Depends(get_db)):
    return services.listar_responsables(db)


@router.get(
    "/configuracion/observacion",
    response_model=list[schemas.ObservacionTipo],
    dependencies=_ADMIN,
)
def listar_observacion(db: Session = Depends(get_db)):
    return services.listar_observacion(db)


@router.put(
    "/configuracion/observacion/{tipo}",
    response_model=schemas.ObservacionTipo,
    dependencies=_ADMIN,
)
def fijar_observacion(
    tipo: str, datos: schemas.ObservacionActualizar, db: Session = Depends(get_db)
):
    return services.fijar_observacion(db, tipo, datos.dias)


@router.delete(
    "/configuracion/observacion/{tipo}",
    response_model=schemas.ObservacionTipo,
    dependencies=_ADMIN,
)
def restablecer_observacion(tipo: str, db: Session = Depends(get_db)):
    """Vuelve al valor por defecto."""
    return services.restablecer_observacion(db, tipo)


# ----------------------------------------------------------------------
# Planes
# ----------------------------------------------------------------------

@router.get(
    "",
    response_model=Union[list[schemas.PlanResumen], schemas.PlanPagina],
    dependencies=_OPERADOR,
)
def listar_planes(
    grupo: Optional[GrupoPlan] = Query(
        None, description="'activos' (en curso) o 'finalizados' (cerrados y cancelados)."
    ),
    estado: Optional[EstadoPlan] = Query(None, description="Un estado puntual."),
    tipo: Optional[str] = Query(None, description="Tipo de situación."),
    buscar: Optional[str] = Query(
        None, max_length=100, description="Busca en el objetivo, la causa o el número."
    ),
    vencidos: bool = Query(False, description="Solo los que tienen un plazo vencido."),
    page: Optional[int] = Query(None, ge=1, description="Sin este parámetro, la lista completa."),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    items, total = services.listar_planes(
        db,
        grupo=grupo,
        estado=estado.value if estado else None,
        tipo=tipo,
        buscar=buscar,
        vencidos=vencidos,
        page=page,
        page_size=page_size,
    )
    if page is None:
        return items
    return schemas.PlanPagina(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=schemas.PlanDetalle, status_code=201)
def crear_plan(
    datos: schemas.PlanCrear,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.crear_plan(db, datos, usuario)


@router.get("/{plan_id}", response_model=schemas.PlanDetalle, dependencies=_OPERADOR)
def obtener_plan(plan_id: int, db: Session = Depends(get_db)):
    return services.obtener_plan(db, plan_id)


@router.patch("/{plan_id}", response_model=schemas.PlanDetalle)
def actualizar_plan(
    plan_id: int,
    datos: schemas.PlanActualizar,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.actualizar_plan(db, plan_id, datos, usuario)


@router.post("/{plan_id}/confirmar", response_model=schemas.PlanDetalle)
def confirmar_plan(
    plan_id: int,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    """Borrador → En ejecución."""
    return services.confirmar_plan(db, plan_id, usuario)


@router.post("/{plan_id}/cancelar", response_model=schemas.PlanDetalle)
def cancelar_plan(
    plan_id: int,
    datos: schemas.CancelarPlan,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.cancelar_plan(db, plan_id, datos.motivo, usuario)


@router.post("/{plan_id}/verificar", response_model=schemas.PlanDetalle)
def verificar_plan(
    plan_id: int,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    """Verifica con lo que el motor detecta ahora todas las situaciones pendientes."""
    return services.verificar_plan(db, plan_id, usuario)


@router.get(
    "/{plan_id}/situaciones-candidatas",
    response_model=list[schemas.SituacionDisponible],
    dependencies=_OPERADOR,
)
def listar_candidatas(plan_id: int, db: Session = Depends(get_db)):
    """Situaciones del mismo tipo que el plan podría sumar (solo en Borrador y
    En ejecución). SAIA las propone; nunca las agrega sola."""
    return services.candidatas_de_plan(db, plan_id)


# ----------------------------------------------------------------------
# Acciones
# ----------------------------------------------------------------------

@router.post("/{plan_id}/acciones", response_model=schemas.PlanDetalle)
def agregar_accion(
    plan_id: int,
    datos: schemas.AccionCrear,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.agregar_accion(db, plan_id, datos, usuario)


@router.patch("/{plan_id}/acciones/{accion_id}", response_model=schemas.PlanDetalle)
def actualizar_accion(
    plan_id: int,
    accion_id: int,
    datos: schemas.AccionActualizar,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.actualizar_accion(db, plan_id, accion_id, datos, usuario)


@router.delete("/{plan_id}/acciones/{accion_id}", response_model=schemas.PlanDetalle)
def eliminar_accion(
    plan_id: int,
    accion_id: int,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.eliminar_accion(db, plan_id, accion_id, usuario)


@router.post("/{plan_id}/acciones/{accion_id}/completar", response_model=schemas.PlanDetalle)
def completar_accion(
    plan_id: int,
    accion_id: int,
    descripcion: str = Form(..., description="Qué se hizo (la evidencia de implementación)."),
    archivo: Optional[UploadFile] = File(None),
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.completar_accion(db, plan_id, accion_id, usuario, descripcion, archivo)


# ----------------------------------------------------------------------
# Alcance y verificación por situación
# ----------------------------------------------------------------------

@router.post("/{plan_id}/situaciones", response_model=schemas.PlanDetalle)
def agregar_situaciones(
    plan_id: int,
    datos: schemas.AgregarSituaciones,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.agregar_situaciones(db, plan_id, datos, usuario)


@router.delete("/{plan_id}/situaciones/{situacion_plan_id}", response_model=schemas.PlanDetalle)
def quitar_situacion(
    plan_id: int,
    situacion_plan_id: int,
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.quitar_situacion(db, plan_id, situacion_plan_id, usuario)


@router.post(
    "/{plan_id}/situaciones/{situacion_plan_id}/verificar",
    response_model=schemas.PlanDetalle,
)
def verificar_situacion(
    plan_id: int,
    situacion_plan_id: int,
    descripcion: Optional[str] = Form(None, description="Evidencia de verificación."),
    resultado: Optional[Literal["corregida", "no_eficaz"]] = Form(
        None, description="Solo para tipos que el motor no detecta."
    ),
    archivo: Optional[UploadFile] = File(None),
    usuario: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.verificar_situacion(
        db,
        plan_id,
        situacion_plan_id,
        usuario,
        descripcion=descripcion,
        resultado=resultado,
        archivo=archivo,
    )
