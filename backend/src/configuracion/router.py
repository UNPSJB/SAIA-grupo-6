from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.notificaciones import schemas, services

# Ajustes del sistema que se cambian desde la app ("Configuración" en el menú
# de usuario). Hoy hay uno solo —los días de antelación con que se alertan los
# vencimientos del personal—, pero la ruta cuelga de `/configuracion` para que
# los próximos ajustes se sumen acá y no dentro de cada módulo.
#
# La lógica y la tabla (`configuracion_alertas`) siguen siendo del módulo de
# notificaciones, que es quien consume el valor para calcular las alertas.
router = APIRouter(
    prefix="/configuracion",
    tags=["Configuración"],
    dependencies=[Depends(require_admin)],
)


@router.get("/alertas", response_model=schemas.ConfiguracionAlertasResponse)
def obtener_configuracion_alertas(db: Session = Depends(get_db)):
    return schemas.ConfiguracionAlertasResponse(
        dias_alerta_vencimiento_personal=services.obtener_dias_alerta_vencimiento_personal(db)
    )


@router.put("/alertas", response_model=schemas.ConfiguracionAlertasResponse)
def actualizar_configuracion_alertas(
    datos: schemas.ConfiguracionAlertasUpdate, db: Session = Depends(get_db)
):
    dias = services.actualizar_dias_alerta_vencimiento_personal(
        db, datos.dias_alerta_vencimiento_personal
    )
    return schemas.ConfiguracionAlertasResponse(dias_alerta_vencimiento_personal=dias)
