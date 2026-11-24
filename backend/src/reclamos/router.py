from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, require_admin, require_operador
from src.common.archivos import guardar_archivo
from src.database import get_db
from src.incidente.constants import EXTENSIONES_FOTO, EstadoIncidente, TAMANO_MAX_FOTO
from src.personal.models import Personal
from src.reclamos import schemas, services

router = APIRouter(prefix="/reclamos", tags=["Reclamos de clientes"])


def _eliminar_foto(ruta_foto: Optional[str]) -> None:
    """Borra la foto recién subida si la transacción del reclamo falla."""
    if not ruta_foto:
        return
    from src.config import CARPETA_UPLOADS

    ruta_abs = CARPETA_UPLOADS / ruta_foto.removeprefix("uploads/")
    try:
        ruta_abs.unlink(missing_ok=True)
    except OSError:
        pass


@router.post(
    "",
    response_model=schemas.ReclamoDetalle,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_operador)],
)
def crear_reclamo(
    salida_id: int = Form(...),
    motivo: str = Form(...),
    detalle: Optional[str] = Form(None),
    fecha_reclamo: date = Form(...),
    foto: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Registra el reclamo de un cliente sobre una entrega (puede_operar).

    Multipart porque la foto es opcional: mismo mecanismo que el rechazo de
    una entrega. El reclamo, el incidente y el hito se guardan en una sola
    transacción; si algo falla, se borra la foto recién subida.
    """
    ruta_foto = None
    if foto is not None and foto.filename:
        ruta_foto = guardar_archivo(
            foto,
            EXTENSIONES_FOTO,
            TAMANO_MAX_FOTO,
            "reclamo",
            "incidentes",
        )

    try:
        reclamo = services.crear_reclamo(
            db,
            salida_id=salida_id,
            motivo=motivo,
            detalle=detalle,
            fecha_reclamo=fecha_reclamo,
            usuario=usuario,
            foto_url=ruta_foto,
        )
    except Exception:
        _eliminar_foto(ruta_foto)
        raise

    return services.reclamo_a_detalle(
        services.obtener_reclamo(db, reclamo.id)
    )


@router.get(
    "",
    response_model=list[schemas.ReclamoResumen],
    dependencies=[Depends(get_current_user)],
)
def listar_reclamos(
    cliente_id: Optional[int] = Query(None, ge=1),
    lote_id: Optional[int] = Query(None, ge=1),
    fuera_de_plazo: Optional[bool] = Query(
        None, description="true solo fuera de plazo, false solo en plazo."
    ),
    estado: Optional[EstadoIncidente] = Query(
        None, description="Estado del incidente vinculado: abierto o cerrado."
    ),
    incidente_id: Optional[int] = Query(
        None, ge=1, description="Reclamos vinculados a un incidente concreto."
    ),
    db: Session = Depends(get_db),
):
    reclamos = services.listar_reclamos(
        db,
        cliente_id=cliente_id,
        lote_id=lote_id,
        fuera_de_plazo=fuera_de_plazo,
        estado_incidente=estado,
        incidente_id=incidente_id,
    )
    return [services.reclamo_a_resumen(r) for r in reclamos]


@router.get(
    "/clientes",
    response_model=list[schemas.ClienteBasico],
    dependencies=[Depends(require_operador)],
)
def listar_clientes_para_reclamo(db: Session = Depends(get_db)):
    """Lista básica de clientes para elegir en el alta de un reclamo.

    Solo lectura: cualquier usuario que puede operar la ve, incluidos los
    clientes inactivos (siguen pudiendo reclamar).
    """
    return services.listar_clientes_para_reclamo(db)


@router.get(
    "/{reclamo_id}",
    response_model=schemas.ReclamoDetalle,
    dependencies=[Depends(get_current_user)],
)
def obtener_reclamo(reclamo_id: int, db: Session = Depends(get_db)):
    reclamo = services.obtener_reclamo(db, reclamo_id)
    return services.reclamo_a_detalle(reclamo)


@router.patch("/{reclamo_id}/cerrar", response_model=schemas.ReclamoDetalle)
def cerrar_reclamo(
    reclamo_id: int,
    datos: schemas.ReclamoCerrar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Cierra el reclamo y su incidente; opcionalmente genera la reposición."""
    reclamo = services.cerrar_reclamo(db, reclamo_id, datos, usuario)
    return services.reclamo_a_detalle(reclamo)


@router.patch("/{reclamo_id}/reabrir", response_model=schemas.ReclamoDetalle)
def reabrir_reclamo(
    reclamo_id: int,
    datos: schemas.ReclamoReabrir,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    """Reabre un reclamo cerrado y su incidente."""
    reclamo = services.reabrir_reclamo(db, reclamo_id, datos.motivo, usuario)
    return services.reclamo_a_detalle(reclamo)
