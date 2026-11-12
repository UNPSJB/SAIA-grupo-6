from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.rotulado_frontal import schemas, services

router = APIRouter(
    prefix="/rotulado-frontal",
    tags=["Rotulado frontal"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/productos/{producto_id}",
    response_model=schemas.EvaluacionRotuladoResponse,
)
def evaluar_producto(
    producto_id: int,
    version_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    return services.evaluar(db, producto_id, version_id)


@router.get(
    "/productos/{producto_id}/evaluaciones",
    response_model=list[schemas.EvaluacionRotuladoGuardadaResponse],
)
def listar_evaluaciones_producto(
    producto_id: int,
    limite: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return services.listar_evaluaciones(db, producto_id, limite)


@router.put(
    "/productos/{producto_id}",
    response_model=schemas.EvaluacionRotuladoResponse,
)
def guardar_producto(
    producto_id: int,
    datos: schemas.ConfiguracionRotuladoIn,
    db: Session = Depends(get_db),
):
    return services.guardar_configuracion(db, producto_id, datos)


@router.get(
    "/ajuste-modulo",
    response_model=schemas.AjusteModuloRotuladoResponse,
)
def obtener_ajuste_modulo(db: Session = Depends(get_db)):
    return services.ajuste_modulo(db)


@router.put(
    "/ajuste-modulo",
    response_model=schemas.AjusteModuloRotuladoResponse,
)
def guardar_ajuste_modulo(
    datos: schemas.AjusteModuloRotuladoIn, db: Session = Depends(get_db)
):
    return services.actualizar_modulo(db, datos.modulo_activo)


@router.get("/reglas", response_model=list[schemas.ReglaRotuladoResponse])
def listar_reglas(db: Session = Depends(get_db)):
    return services.listar_reglas(db)


@router.post(
    "/reglas",
    response_model=schemas.ReglaRotuladoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_regla(datos: schemas.ReglaRotuladoIn, db: Session = Depends(get_db)):
    return services.crear_regla(db, datos)


@router.post(
    "/reglas/{regla_id}/activar",
    response_model=schemas.ReglaRotuladoResponse,
)
def activar_regla(regla_id: int, db: Session = Depends(get_db)):
    return services.activar_regla(db, regla_id)
