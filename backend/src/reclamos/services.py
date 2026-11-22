from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, object_session, selectinload

from src.common.fechas import hoy
from src.incidente import services as incidente_services
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.incidente.models import Incidente
from src.clientes.models import Cliente
from src.lotes.models import LoteProducto
from src.notificaciones.services import obtener_plazo_reclamo_dias
from src.personal.models import Personal
from src.reclamos import exceptions, schemas
from src.reclamos.constants import (
    ETIQUETAS_MOTIVO_RECLAMO,
    MOTIVO_RECLAMO_OTRO,
    MOTIVOS_RECLAMO,
    TIPO_EVENTO_RECLAMO,
)
from src.reclamos.models import Reclamo
from src.salidas import exceptions as salidas_exceptions
from src.salidas import services as salidas_services
from src.salidas.constants import ESTADO_ENTREGADO
from src.salidas.models import Salida


def _nombre_completo(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _etiqueta_motivo(motivo: str) -> str:
    return ETIQUETAS_MOTIVO_RECLAMO.get(motivo, motivo)


def _descripcion_incidente(
    salida: Salida, motivo: str, detalle: str, fuera_de_plazo: bool, dias: int
) -> str:
    unidad = (
        salida.lote.producto.unidad_medida.simbolo
        if salida.lote.producto and salida.lote.producto.unidad_medida
        else ""
    )
    partes = [
        f"El cliente {salida.cliente.nombre} reclamó sobre la entrega de "
        f"{salidas_services.formatear_cantidad(salida.cantidad)} {unidad} del lote "
        f"{salida.lote.numero_lote} ({salida.lote.producto.nombre}).",
        f"Fecha de entrega: {salida.fecha_entrega.strftime('%d/%m/%Y')}.",
        f"Motivo: {_etiqueta_motivo(motivo)}.",
    ]
    if detalle:
        partes.append(f"Detalle: {detalle}.")
    if fuera_de_plazo:
        partes.append(f"Fuera de plazo ({dias} días desde la entrega).")
    return " ".join(partes)


def crear_reclamo(
    db: Session,
    *,
    salida_id: int,
    motivo: str,
    detalle: Optional[str],
    fecha_reclamo: date,
    usuario: Personal,
    foto_url: Optional[str] = None,
) -> Reclamo:
    """Registra un reclamo de cliente sobre una entrega (Historia 20).

    Todo en UNA transacción: reclamo + incidente "Reclamo de cliente" + hito
    RECLAMO. Si algo falla no queda nada guardado.

    El estado de la salida no cambia. Se permite reclamar aunque el lote esté
    retirado o vencido: se registra lo que el cliente reportó.
    """
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise salidas_exceptions.SalidaNoEncontrada()

    if salida.estado != ESTADO_ENTREGADO or salida.fecha_entrega is None:
        raise exceptions.ReclamoSalidaNoEntregada(
            "Solo se puede reclamar sobre una salida entregada. "
            f"La salida está en '{salida.estado}'."
        )

    motivo = (motivo or "").strip()
    if motivo not in MOTIVOS_RECLAMO:
        raise exceptions.ReclamoMotivoInvalido()

    detalle = (detalle or "").strip()
    if motivo == MOTIVO_RECLAMO_OTRO and not detalle:
        raise exceptions.ReclamoDetalleRequerido()
    if len(detalle) > 500:
        raise exceptions.ReclamoDetalleDemasiadoLargo()

    hoy_ar = hoy()
    if fecha_reclamo < salida.fecha_entrega or fecha_reclamo > hoy_ar:
        raise exceptions.ReclamoFechaInvalida()

    dias_desde_entrega = (fecha_reclamo - salida.fecha_entrega).days
    plazo_referencia_dias = obtener_plazo_reclamo_dias(db)
    fuera_de_plazo = dias_desde_entrega > plazo_referencia_dias

    descripcion = _descripcion_incidente(
        salida, motivo, detalle, fuera_de_plazo, dias_desde_entrega
    )

    incidente = incidente_services.crear_incidente_vinculado(
        db,
        titulo=f"Reclamo de cliente · Lote {salida.lote.numero_lote}"[:60],
        descripcion=descripcion,
        tipo=TipoIncidente.RECLAMO_CLIENTE.value,
        usuario_id=usuario.id,
        foto_url=foto_url,
        lote_id=salida.lote_id,
        salida_id=salida.id,
    )

    reclamo = Reclamo(
        salida_id=salida.id,
        lote_id=salida.lote_id,
        cliente_id=salida.cliente_id,
        incidente_id=incidente.id,
        fecha_reclamo=fecha_reclamo,
        motivo=motivo,
        detalle=detalle or None,
        fecha_entrega_ref=salida.fecha_entrega,
        dias_desde_entrega=dias_desde_entrega,
        plazo_referencia_dias=plazo_referencia_dias,
        fuera_de_plazo=fuera_de_plazo,
        registrado_por_id=usuario.id,
    )
    db.add(reclamo)
    # Flush para validar el INSERT y tener el id antes del hito.
    db.flush()

    descripcion_hito = (
        f"Reclamo de {salida.cliente.nombre} sobre la entrega del "
        f"{salida.fecha_entrega.strftime('%d/%m/%Y')}: {_etiqueta_motivo(motivo)}."
    )
    if fuera_de_plazo:
        descripcion_hito += f" Fuera de plazo ({dias_desde_entrega} días)."

    try:
        salidas_services.registrar_hito(
            db,
            lote_id=salida.lote_id,
            tipo_evento=TIPO_EVENTO_RECLAMO,
            descripcion=descripcion_hito,
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise

    db.refresh(reclamo)
    return reclamo


def _consulta_reclamos(
    cliente_id: Optional[int] = None,
    lote_id: Optional[int] = None,
    fuera_de_plazo: Optional[bool] = None,
    estado_incidente: Optional[EstadoIncidente] = None,
    incidente_id: Optional[int] = None,
):
    consulta = select(Reclamo).options(
        selectinload(Reclamo.cliente),
        selectinload(Reclamo.lote).selectinload(LoteProducto.producto),
        selectinload(Reclamo.incidente),
    )
    if cliente_id is not None:
        consulta = consulta.where(Reclamo.cliente_id == cliente_id)
    if lote_id is not None:
        consulta = consulta.where(Reclamo.lote_id == lote_id)
    if fuera_de_plazo is not None:
        consulta = consulta.where(Reclamo.fuera_de_plazo.is_(fuera_de_plazo))
    if incidente_id is not None:
        consulta = consulta.where(Reclamo.incidente_id == incidente_id)
    if estado_incidente is not None:
        valor = (
            estado_incidente.value
            if isinstance(estado_incidente, EstadoIncidente)
            else str(estado_incidente)
        )
        consulta = consulta.join(
            Incidente, Incidente.id == Reclamo.incidente_id
        ).where(Incidente.estado == valor)
    return consulta.order_by(Reclamo.fecha_reclamo.desc(), Reclamo.id.desc())


def listar_reclamos(
    db: Session,
    cliente_id: Optional[int] = None,
    lote_id: Optional[int] = None,
    fuera_de_plazo: Optional[bool] = None,
    estado_incidente: Optional[EstadoIncidente] = None,
    incidente_id: Optional[int] = None,
) -> list[Reclamo]:
    """Listado de reclamos, del más reciente al más viejo.

    Carga cliente, lote e incidente con `selectinload` para evitar N+1.
    """
    return list(
        db.scalars(
            _consulta_reclamos(
                cliente_id, lote_id, fuera_de_plazo, estado_incidente, incidente_id
            )
        ).all()
    )


def listar_clientes_para_reclamo(db: Session) -> list[schemas.ClienteBasico]:
    """Clientes básicos para elegir en el alta de un reclamo.

    Solo lectura y abierta a quien puede operar: se incluyen los inactivos
    porque un cliente dado de baja sigue pudiendo reclamar.
    """
    clientes = db.scalars(
        select(Cliente).order_by(Cliente.nombre.asc(), Cliente.id.asc())
    ).all()
    return [
        schemas.ClienteBasico(
            id=c.id,
            nombre=c.nombre,
            activo=c.activo,
        )
        for c in clientes
    ]


def obtener_reclamo(db: Session, reclamo_id: int) -> Reclamo:
    reclamo = db.scalar(
        select(Reclamo)
        .options(
            selectinload(Reclamo.cliente),
            selectinload(Reclamo.lote),
            selectinload(Reclamo.incidente),
            selectinload(Reclamo.registrado_por),
            selectinload(Reclamo.salida).selectinload(Salida.lote).selectinload(
                LoteProducto.producto
            ),
        )
        .where(Reclamo.id == reclamo_id)
    )
    if reclamo is None:
        raise exceptions.ReclamoNoEncontrado()
    return reclamo


def reclamo_a_resumen(reclamo: Reclamo) -> schemas.ReclamoResumen:
    return schemas.ReclamoResumen(
        id=reclamo.id,
        salida_id=reclamo.salida_id,
        cliente_id=reclamo.cliente_id,
        cliente_nombre=reclamo.cliente.nombre,
        lote_id=reclamo.lote_id,
        lote_numero=reclamo.lote.numero_lote,
        producto_nombre=reclamo.lote.producto.nombre,
        fecha_entrega=reclamo.fecha_entrega_ref,
        fecha_reclamo=reclamo.fecha_reclamo,
        motivo=reclamo.motivo,
        motivo_label=_etiqueta_motivo(reclamo.motivo),
        detalle=reclamo.detalle,
        dias_desde_entrega=reclamo.dias_desde_entrega,
        plazo_referencia_dias=reclamo.plazo_referencia_dias,
        fuera_de_plazo=reclamo.fuera_de_plazo,
        incidente_id=reclamo.incidente_id,
        incidente_estado=(
            reclamo.incidente.estado if reclamo.incidente is not None else None
        ),
    )


def _retiro_del_lote(reclamo: Reclamo) -> Optional[schemas.ReclamoRetiroDetalle]:
    """El retiro del lote del reclamo, si ya existe: la ficha lo muestra en vez de
    ofrecer iniciar otro (un lote admite un solo retiro)."""
    from src.retiros.models import Retiro

    db = object_session(reclamo)
    if db is None:
        return None
    retiro = db.execute(
        select(Retiro).where(Retiro.lote_id == reclamo.salida.lote_id)
    ).scalar_one_or_none()
    if retiro is None:
        return None
    return schemas.ReclamoRetiroDetalle(id=retiro.id, estado=retiro.estado)


def reclamo_a_detalle(reclamo: Reclamo) -> schemas.ReclamoDetalle:
    salida = reclamo.salida
    incidente = reclamo.incidente
    unidad = (
        salida.lote.producto.unidad_medida.simbolo
        if salida.lote.producto and salida.lote.producto.unidad_medida
        else ""
    )
    return schemas.ReclamoDetalle(
        **reclamo_a_resumen(reclamo).model_dump(),
        registrado_por_nombre=_nombre_completo(reclamo.registrado_por),
        fecha_registro=(
            reclamo.fecha_registro.isoformat() if reclamo.fecha_registro else None
        ),
        salida=schemas.ReclamoSalidaDetalle(
            id=salida.id,
            fecha_entrega=salida.fecha_entrega,
            fecha_despacho=salida.fecha_despacho,
            cantidad=salidas_services.formatear_cantidad(salida.cantidad),
            unidad_medida=unidad,
            producto_nombre=salida.lote.producto.nombre,
            lote_numero=salida.lote.numero_lote,
        ),
        incidente=(
            schemas.ReclamoIncidenteDetalle(
                id=incidente.id,
                estado=incidente.estado,
                foto_url=incidente.foto_url,
                fecha_cierre=(
                    incidente.fecha_cierre.isoformat()
                    if incidente.fecha_cierre
                    else None
                ),
                observacion_cierre=incidente.observacion_cierre,
                responsable_cierre_nombre=_nombre_completo(
                    incidente.responsable_cierre
                ),
            )
            if incidente is not None
            else None
        ),
        retiro=_retiro_del_lote(reclamo),
    )
