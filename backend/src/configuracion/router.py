from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, require_admin
from src.database import get_db
from src.notificaciones import impacto, schemas, services

# Ajustes del sistema que se cambian desde la app ("Configuración" en el menú
# de usuario). La ruta cuelga de `/configuracion` para que los próximos ajustes
# se sumen acá y no dentro de cada módulo.
#
# La lógica y la tabla (`configuracion_alertas`) siguen siendo del módulo de
# notificaciones. La configuración completa se reserva a administración; el
# plazo de reclamos se expone aparte porque lo necesita el alta de reclamos.
router = APIRouter(prefix="/configuracion", tags=["Configuración"])


def _respuesta(db: Session) -> schemas.ConfiguracionAlertasResponse:
    return schemas.ConfiguracionAlertasResponse(
        dias_alerta_vencimiento_personal=services.obtener_dias_alerta_vencimiento_personal(db),
        plazo_reclamo_dias=services.obtener_plazo_reclamo_dias(db),
        meta_cumplimiento_limpieza=services.obtener_meta_cumplimiento_limpieza(db),
    )


@router.get(
    "/alertas",
    response_model=schemas.ConfiguracionAlertasResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_configuracion_alertas(db: Session = Depends(get_db)):
    return _respuesta(db)


@router.get("/plazo-reclamo", response_model=schemas.PlazoReclamoResponse)
def obtener_plazo_reclamo(
    db: Session = Depends(get_db),
    _usuario=Depends(get_current_user),
):
    """Solo el plazo: lo consume el alta de reclamos, que no administra ajustes."""
    return schemas.PlazoReclamoResponse(
        plazo_reclamo_dias=services.obtener_plazo_reclamo_dias(db)
    )


@router.put(
    "/alertas",
    response_model=schemas.ConfiguracionAlertasResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_configuracion_alertas(
    datos: schemas.ConfiguracionAlertasUpdate, db: Session = Depends(get_db)
):
    # Actualización parcial: solo se aplican los campos enviados. Un campo
    # ausente (o `null`) deja el valor vigente tal cual.
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if "dias_alerta_vencimiento_personal" in cambios:
        services.actualizar_dias_alerta_vencimiento_personal(
            db, cambios["dias_alerta_vencimiento_personal"]
        )
    if "plazo_reclamo_dias" in cambios:
        services.actualizar_plazo_reclamo_dias(db, cambios["plazo_reclamo_dias"])
    if "meta_cumplimiento_limpieza" in cambios:
        services.actualizar_meta_cumplimiento_limpieza(
            db, cambios["meta_cumplimiento_limpieza"]
        )
    return _respuesta(db)


# Impacto base de cada tipo de situación del motor de riesgos. SAIA sugiere una
# clasificación y el administrador del establecimiento la puede cambiar.
@router.get(
    "/impacto-situaciones",
    response_model=list[schemas.ImpactoSituacionResponse],
    dependencies=[Depends(require_admin)],
)
def listar_impacto_situaciones(db: Session = Depends(get_db)):
    return impacto.listar_impactos(db)


@router.put(
    "/impacto-situaciones/{tipo}",
    response_model=schemas.ImpactoSituacionResponse,
    dependencies=[Depends(require_admin)],
)
def fijar_impacto_situacion(
    tipo: str,
    datos: schemas.ImpactoSituacionUpdate,
    db: Session = Depends(get_db),
):
    return impacto.fijar_impacto(db, tipo, datos)


@router.delete(
    "/impacto-situaciones/{tipo}",
    response_model=schemas.ImpactoSituacionResponse,
    dependencies=[Depends(require_admin)],
)
def restaurar_impacto_situacion(tipo: str, db: Session = Depends(get_db)):
    """Vuelve al impacto sugerido por SAIA."""
    return impacto.restaurar_impacto(db, tipo)
