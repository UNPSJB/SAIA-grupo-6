from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import require_admin
from src.notificaciones import schemas, services

# Las alertas de recambio y vencimientos son parte de las historias de
# administración ("Como: persona con permiso de administrar").
router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"],
    dependencies=[Depends(require_admin)],
)

@router.get("", response_model=List[schemas.NotificacionResponse])
def listar_notificaciones(db: Session = Depends(get_db)):
    return services.obtener_todas_notificaciones(db)


@router.get("/configuracion", response_model=schemas.ConfiguracionAlertasResponse)
def obtener_configuracion(db: Session = Depends(get_db)):
    return schemas.ConfiguracionAlertasResponse(
        dias_alerta_vencimiento_personal=services.obtener_dias_alerta_vencimiento_personal(db)
    )


@router.put("/configuracion", response_model=schemas.ConfiguracionAlertasResponse)
def actualizar_configuracion(
    datos: schemas.ConfiguracionAlertasUpdate, db: Session = Depends(get_db)
):
    dias = services.actualizar_dias_alerta_vencimiento_personal(
        db, datos.dias_alerta_vencimiento_personal
    )
    return schemas.ConfiguracionAlertasResponse(dias_alerta_vencimiento_personal=dias)