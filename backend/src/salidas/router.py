from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.auth.dependencies import get_current_user, require_admin, require_operador

# Quién hace qué: lo comercial (reservar a un cliente, cancelar una reserva y
# resolver un rechazo) es de quien administra; lo físico de expedición
# (despachar, registrar la entrega o el rechazo en la puerta) lo registra
# quien opera. Ver y consultar las salidas, ambos.
from src.clientes.models import Cliente
from src.common.archivos import guardar_archivo
from src.database import get_db
from src.incidente.constants import EXTENSIONES_FOTO, TAMANO_MAX_FOTO
from src.lotes.models import LoteProducto
from src.personal.models import Personal
from src.salidas import schemas, services
from src.salidas.models import HitoLote, calcular_cantidades

router = APIRouter(prefix="/salidas", tags=["Salidas de producto"])


def _eliminar_foto(ruta_foto: str | None) -> None:
    """Borra la foto recién subida si la transacción de la salida falla."""
    if not ruta_foto:
        return
    from src.config import CARPETA_UPLOADS

    ruta_abs = CARPETA_UPLOADS / ruta_foto.removeprefix("uploads/")
    try:
        ruta_abs.unlink(missing_ok=True)
    except OSError:
        pass


@router.post(
    "/reservar",
    response_model=schemas.SalidaResumen,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def reservar_salida(
    datos: schemas.SalidaCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    salida = services.reservar(
        db,
        lote_id=datos.lote_id,
        cliente_id=datos.cliente_id,
        cantidad=datos.cantidad,
        fecha_reserva=datos.fecha_reserva,
        usuario=usuario,
    )
    return services.salida_a_resumen(salida)


@router.get(
    "",
    response_model=list[schemas.SalidaResumen],
    dependencies=[Depends(get_current_user)],
)
def listar_salidas(
    estado: str | None = Query(
        None,
        description=(
            "Filtrar por estado: RESERVADO, DESPACHADO, ENTREGADO, "
            "CANCELADO, RECHAZADA."
        ),
    ),
    lote_id: int | None = Query(None, ge=1, description="Filtrar por lote."),
    cliente_id: int | None = Query(None, ge=1, description="Filtrar por cliente."),
    db: Session = Depends(get_db),
):
    salidas = services.listar_salidas(
        db, estado=estado, lote_id=lote_id, cliente_id=cliente_id
    )
    return [services.salida_a_resumen(s, db) for s in salidas]


@router.get(
    "/clientes-disponibles",
    response_model=list[schemas.ClienteDisponible],
    dependencies=[Depends(require_admin)],
)
def listar_clientes_disponibles(db: Session = Depends(get_db)):
    """Lista básica de clientes activos para elegir al reservar una salida.

    Solo lectura: cualquier usuario que puede operar la ve.
    """
    return services.obtener_clientes_disponibles(db)


@router.get(
    "/lotes-disponibles",
    response_model=list[schemas.LoteDisponible],
    dependencies=[Depends(require_admin)],
)
def listar_lotes_disponibles(db: Session = Depends(get_db)):
    """Lista de lotes con saldo disponible para reservar (puede_operar).

    Solo lectura: se devuelven los lotes que aún tienen mercadería
    disponible, ordenados por código de lote.
    """
    return services.obtener_lotes_disponibles(db)


@router.get(
    "/{salida_id}",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(get_current_user)],
)
def obtener_salida(
    salida_id: int,
    db: Session = Depends(get_db),
):
    salida = services.obtener_salida(db, salida_id)
    return services.salida_a_resumen(salida, db)


@router.post(
    "/{salida_id}/despachar",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(require_operador)],
)
def despachar_salida(
    salida_id: int,
    datos: schemas.SalidaDespachar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    salida = services.despachar(
        db,
        salida_id=salida_id,
        forma_entrega=datos.forma_entrega,
        transportista_id=datos.transportista_id,
        fecha_despacho=datos.fecha_despacho,
        usuario=usuario,
    )
    return services.salida_a_resumen(salida)


@router.post(
    "/{salida_id}/entregar",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(require_operador)],
)
def entregar_salida(
    salida_id: int,
    datos: schemas.SalidaEntregar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    salida = services.entregar(
        db,
        salida_id=salida_id,
        fecha_entrega=datos.fecha_entrega,
        observacion=datos.observacion,
        usuario=usuario,
        recibido_por=datos.recibido_por,
    )
    return services.salida_a_resumen(salida)


@router.post(
    "/{salida_id}/cancelar",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(require_admin)],
)
def cancelar_salida(
    salida_id: int,
    datos: schemas.SalidaCancelar,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    salida = services.cancelar(
        db,
        salida_id=salida_id,
        motivo=datos.motivo,
        usuario=usuario,
    )
    return services.salida_a_resumen(salida)


@router.post(
    "/{salida_id}/rechazar",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(require_operador)],
)
def rechazar_salida(
    salida_id: int,
    motivo: str = Form(...),
    detalle: str | None = Form(None),
    fecha_rechazo: date = Form(...),
    foto: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Registra el rechazo de una entrega despachada (puede_operar).

    Multipart porque la foto es opcional: mismo mecanismo que el alta de un
    incidente. La salida, el incidente y el hito se guardan en una sola
    transacción; si algo falla, se borra la foto recién subida.
    """
    ruta_foto = None
    if foto is not None and foto.filename:
        ruta_foto = guardar_archivo(
            foto,
            EXTENSIONES_FOTO,
            TAMANO_MAX_FOTO,
            "rechazo",
            "incidentes",
        )

    try:
        salida = services.rechazar(
            db,
            salida_id=salida_id,
            motivo=motivo,
            detalle=detalle,
            fecha_rechazo=fecha_rechazo,
            usuario=usuario,
            foto_url=ruta_foto,
        )
    except Exception:
        _eliminar_foto(ruta_foto)
        raise
    return services.salida_a_resumen(salida)


@router.post(
    "/{salida_id}/resolver-rechazo",
    response_model=schemas.SalidaResumen,
    dependencies=[Depends(require_admin)],
)
def resolver_rechazo(
    salida_id: int,
    datos: schemas.SalidaResolverRechazo,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
):
    """Resuelve un rechazo: reingresa al lote o desecha (puede_administrar)."""
    salida = services.resolver_rechazo(
        db,
        salida_id=salida_id,
        disposicion=datos.disposicion,
        justificacion=datos.justificacion,
        usuario=usuario,
    )
    return services.salida_a_resumen(salida)


@router.get(
    "/lotes/{lote_id}/hitos",
    response_model=list[schemas.HitoLoteResumen],
    dependencies=[Depends(get_current_user)],
)
def listar_hitos_lote(
    lote_id: int,
    db: Session = Depends(get_db),
):
    # Verificar que el lote existe.
    db.get(LoteProducto, lote_id)  # noqa: B018  (solo para validar existencia)
    # Nota: si el lote no existe, db.get devuelve None y FastAPI no lanza 404
    # automáticamente. Lo validamos explícitamente abajo.
    from sqlalchemy import select

    lote = db.scalar(select(LoteProducto).where(LoteProducto.id == lote_id))
    if lote is None:
        from src.lotes import exceptions as lotes_exceptions

        raise lotes_exceptions.LoteNoEncontrado()

    consulta = (
        select(HitoLote)
        .where(HitoLote.lote_id == lote_id)
        .order_by(HitoLote.fecha_hora.asc(), HitoLote.id.asc())
    )
    hitos = list(db.scalars(consulta).all())

    # Enriquecer con nombre de usuario.
    from src.personal.models import Personal

    usuarios = {
        u.id: u
        for u in db.scalars(
            select(Personal).where(Personal.id.in_([h.usuario_id for h in hitos]))
        ).all()
    } if hitos else {}

    return [
        schemas.HitoLoteResumen(
            id=h.id,
            lote_id=h.lote_id,
            salida_id=h.salida_id,
            fecha_hora=h.fecha_hora.isoformat(),
            tipo_evento=h.tipo_evento,
            descripcion=h.descripcion,
            usuario_id=h.usuario_id,
            usuario_nombre=(
                f"{usuarios[h.usuario_id].nombre} {usuarios[h.usuario_id].apellido or ''}".strip()
                if h.usuario_id in usuarios
                else None
            ),
        )
        for h in hitos
    ]
