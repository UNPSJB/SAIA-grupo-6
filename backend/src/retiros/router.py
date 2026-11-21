from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, require_admin, require_operador
from src.database import get_db
from src.incidente.models import Incidente
from src.personal.models import Personal
from src.retiros import schemas, services
from src.retiros.constants import (
    ESTADO_NOTIFICACION_PENDIENTE,
    ESTADO_RETIRO_CERRADO,
    ESTADO_RETIRO_EN_CURSO,
)

router = APIRouter(prefix="/retiros", tags=["Retiros de lote"])


@router.post(
    "",
    response_model=schemas.RetiroDetalle,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def crear_retiro(
    datos: schemas.RetiroCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Inicia el retiro de un lote del mercado (puede_administrar).

    Todo en una sola transacción: marcar lote como retirado, cancelar reservas,
    crear afectados, crear incidente y registrar hito.
    """
    retiro = services.iniciar_retiro(
        db,
        lote_id=datos.lote_id,
        motivo=datos.motivo,
        detalle=datos.detalle,
        fecha_retiro=datos.fecha_retiro,
        usuario=usuario,
        origen="",
        reclamo_id=datos.reclamo_id,
    )
    db.commit()
    return services.retiro_a_detalle(retiro)


@router.get(
    "",
    response_model=list[schemas.RetiroResumen],
    dependencies=[Depends(get_current_user)],
)
def listar_retiros(
    lote_id: Optional[int] = Query(None, ge=1),
    estado: Optional[str] = Query(None),
    incidente_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    """Listado de retiros. Cualquier usuario autenticado puede leerlo."""
    retiros = services.listar_retiros(
        db, lote_id=lote_id, estado=estado, incidente_id=incidente_id
    )
    return [services.retiro_a_resumen(r) for r in retiros]


@router.get(
    "/{retiro_id}",
    response_model=schemas.RetiroDetalle,
    dependencies=[Depends(get_current_user)],
)
def obtener_retiro(retiro_id: int, db: Session = Depends(get_db)):
    """Detalle completo de un retiro. Cualquier usuario autenticado puede leerlo."""
    retiro = services.obtener_retiro(db, retiro_id)
    # Rellenar el estado del incidente si existe
    incidente_estado = None
    if retiro.incidente_id is not None:
        incidente = db.get(Incidente, retiro.incidente_id)
        if incidente is not None:
            incidente_estado = incidente.estado
    detalle = services.retiro_a_detalle(retiro)
    detalle.incidente_estado = incidente_estado
    return detalle


@router.post(
    "/{retiro_id}/afectados/{afectado_id}/notificar",
    response_model=schemas.RetiroAfectadoResumen,
    dependencies=[Depends(require_operador)],
)
def notificar_afectado(
    retiro_id: int,
    afectado_id: int,
    datos: schemas.RetiroNotificar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Notifica a un cliente afectado por un retiro (puede_operar)."""
    afectado = services.notificar_afectado(
        db,
        retiro_id=retiro_id,
        afectado_id=afectado_id,
        fecha_notificacion=datos.fecha_notificacion,
        medio_contacto=datos.medio_contacto,
        observacion=datos.observacion,
        usuario=usuario,
    )
    db.commit()
    return services.afectado_a_resumen(afectado)


@router.post(
    "/{retiro_id}/cerrar",
    response_model=schemas.RetiroDetalle,
    dependencies=[Depends(require_admin)],
)
def cerrar_retiro(
    retiro_id: int,
    datos: schemas.RetiroCerrar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Cierra un retiro y su incidente vinculado (puede_administrar)."""
    retiro = services.cerrar_retiro(
        db,
        retiro_id=retiro_id,
        accion_correctiva=datos.accion_correctiva,
        usuario=usuario,
    )
    db.commit()
    # Rellenar el estado del incidente si existe
    incidente_estado = None
    if retiro.incidente_id is not None:
        incidente = db.get(Incidente, retiro.incidente_id)
        if incidente is not None:
            incidente_estado = incidente.estado
    detalle = services.retiro_a_detalle(retiro)
    detalle.incidente_estado = incidente_estado
    return detalle


@router.post(
    "/masivo-insumo",
    response_model=schemas.RetiroMasivoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def iniciar_retiro_masivo_insumo(
    datos: schemas.RetiroMasivoInsumoCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    try:
        resultado = services.iniciar_retiro_masivo_insumo(db, datos, usuario)
        db.commit()
        return resultado
    except Exception:
        db.rollback()
        raise





