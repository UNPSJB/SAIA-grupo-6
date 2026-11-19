from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.certificaciones_transportista import (
    schemas as certificaciones_schemas,
)
from src.certificaciones_transportista.estado import (
    ESTADO_HABILITADO,
    estado_habilitacion,
)
from src.certificaciones_transportista.models import CertificacionTransportista
from src.clientes.models import Cliente
from src.common.fechas import ahora, hoy
from src.incidente import services as incidente_services
from src.incidente.constants import TipoIncidente
from src.incidente.models import Incidente
from src.lotes.models import LoteProducto
from src.personal.models import Personal
from src.reclamos.constants import ETIQUETAS_MOTIVO_RECLAMO
from src.reclamos.models import Reclamo
from src.salidas import exceptions, schemas
from src.salidas.constants import (
    DISPOSICION_DESECHADA,
    DISPOSICION_REINGRESADA,
    DISPOSICIONES,
    ESTADO_CANCELADO,
    ESTADO_DESPACHADO,
    ESTADO_ENTREGADO,
    ESTADO_RECHAZADA,
    ESTADO_RESERVADO,
    ETIQUETAS_MOTIVO_RECHAZO,
    FORMA_ENTREGA_CON_TRANSPORTISTA,
    FORMA_ENTREGA_RETIRA_CLIENTE,
    MOTIVO_RECHAZO_OTRO,
    MOTIVOS_RECHAZO,
    TIPO_EVENTO_CANCELACION,
    TIPO_EVENTO_DESPACHO,
    TIPO_EVENTO_DISPOSICION,
    TIPO_EVENTO_ENTREGA,
    TIPO_EVENTO_RECHAZO,
    TIPO_EVENTO_RESERVA,
)
from src.salidas.models import HitoLote, Salida, SalidaCertificacion, calcular_cantidades, formatear_cantidad
from src.transportistas.models import Transportista
from src.unidadMedida.cantidades import es_cantidad_valida

# Máquina de estados: transiciones permitidas (estado actual -> estados destino).
_TRANSICIONES_PERMITIDAS: dict[str, set[str]] = {
    ESTADO_RESERVADO: {ESTADO_DESPACHADO, ESTADO_CANCELADO},
    ESTADO_DESPACHADO: {ESTADO_ENTREGADO, ESTADO_RECHAZADA},
    # ESTADO_ENTREGADO, ESTADO_CANCELADO y ESTADO_RECHAZADA son finales: la
    # resolución del rechazo se guarda en los campos de disposición, no acá.
}


def _exigir_transicion(salida: Salida, estado_destino: str) -> None:
    """Valida que la transición del estado actual al destino esté permitida."""
    estados_validos = _TRANSICIONES_PERMITIDAS.get(salida.estado, set())
    if estado_destino not in estados_validos:
        raise exceptions.TransicionInvalida(
            f"No se puede pasar de '{salida.estado}' a '{estado_destino}'. "
            f"Transiciones válidas desde '{salida.estado}': "
            f"{', '.join(sorted(estados_validos)) or 'ninguna'}."
        )


def _obtener_lote_o_error(db: Session, lote_id: int) -> LoteProducto:
    lote = db.get(LoteProducto, lote_id)
    if lote is None:
        raise exceptions.LoteNoEncontrado()
    return lote


def _obtener_cliente_o_error(db: Session, cliente_id: int) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise exceptions.ClienteNoEncontrado()
    if not cliente.activo:
        raise exceptions.ClienteInactivo()
    return cliente


def _obtener_transportista_o_error(
    db: Session, transportista_id: int
) -> Transportista:
    consulta = (
        select(Transportista)
        .options(selectinload(Transportista.certificaciones))
        .where(Transportista.id == transportista_id)
    )
    transportista = db.scalar(consulta)
    if transportista is None:
        raise exceptions.TransportistaNoEncontrado()
    return transportista


def _obtener_salida_o_error(db: Session, salida_id: int) -> Salida:
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise exceptions.SalidaNoEncontrada()
    return salida


def registrar_hito(
    db: Session,
    lote_id: int,
    tipo_evento: str,
    descripcion: str,
    usuario_id: int,
    salida_id: int | None = None,
) -> HitoLote:
    """Registra un hito en la línea de tiempo del lote.

    NO hace commit: se ejecuta dentro de la transacción de quien la llama,
    para que las próximas historias (despachar, entregar, cancelar, retirar)
    la reutilicen dentro de su propia transacción.
    """
    hito = HitoLote(
        lote_id=lote_id,
        salida_id=salida_id,
        fecha_hora=ahora(),
        tipo_evento=tipo_evento,
        descripcion=descripcion,
        usuario_id=usuario_id,
    )
    db.add(hito)
    db.flush()
    return hito


def reservar(
    db: Session,
    lote_id: int,
    cliente_id: int,
    cantidad: Decimal,
    fecha_reserva: date,
    usuario: Personal,
) -> Salida:
    """Reserva una cantidad de un lote para un cliente.

    Validaciones:
    - Lote existe y no está retirado.
    - Cliente existe y está activo.
    - cantidad > 0.
    - cantidad <= saldo del lote.
    - fecha_reserva no anterior a fecha_inicio del lote (si la tiene).

    Todo en una sola transacción: salida + hito.
    """
    lote = _obtener_lote_o_error(db, lote_id)

    if lote.retirado:
        raise exceptions.LoteRetirado()

    if lote.fecha_vencimiento is not None and lote.fecha_vencimiento < hoy():
        raise exceptions.LoteVencidoError()

    cliente = _obtener_cliente_o_error(db, cliente_id)

    hoy_ar = hoy()
    if fecha_reserva > hoy_ar:
        raise exceptions.FechaReservaFutura()

    # Saldo actual del lote (sin incluir esta reserva pendiente).
    salidas = list(lote.salidas) if lote.salidas is not None else []
    calculo = calcular_cantidades(lote.cantidad_producida, salidas, lote.retirado)

    if cantidad <= 0:
        raise exceptions.CantidadInvalida()

    if not es_cantidad_valida(cantidad, lote.producto.unidad_medida):
        raise exceptions.CantidadNoEntera()

    if cantidad > calculo["saldo"]:
        raise exceptions.SaldoInsuficiente()

    if lote.fecha_inicio is not None and fecha_reserva < lote.fecha_inicio.date():
        raise exceptions.FechaAnteriorAElaboracion()

    # Descripción del hito con datos reales.
    unidad = lote.producto.unidad_medida.simbolo if lote.producto and lote.producto.unidad_medida else ""
    descripcion = (
        f"Reserva de {formatear_cantidad(cantidad)} {unidad} para {cliente.nombre} "
        f"(usuario: {usuario.nombre} {usuario.apellido or ''})."
    )

    salida = Salida(
        lote_id=lote_id,
        cliente_id=cliente_id,
        cantidad=cantidad,
        fecha_reserva=fecha_reserva,
        estado=ESTADO_RESERVADO,
        creado_por_id=usuario.id,
    )
    db.add(salida)
    # Flush para que `salida.id` se asigne antes de registrar el hito que la referencia.
    db.flush()
    try:
        registrar_hito(
            db,
            lote_id=lote_id,
            tipo_evento=TIPO_EVENTO_RESERVA,
            descripcion=descripcion,
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def despachar(
    db: Session,
    salida_id: int,
    forma_entrega: str,
    transportista_id: int | None,
    fecha_despacho: date,
    usuario: Personal,
) -> Salida:
    """Despacha una reserva: pasa a estado DESPACHADO.

    Validaciones:
    - La salida existe y está en RESERVADO.
    - El lote NO está retirado.
    - fecha_despacho no anterior a fecha_reserva y no posterior a hoy.
    - Si forma_entrega = CON_TRANSPORTISTA:
        - transportista_id obligatorio.
        - Transportista existe y está activo.
        - estado_habilitacion (con fecha HOY) debe ser "Habilitado".
    - Si forma_entrega = RETIRA_CLIENTE: transportista_id debe ser None.

    Guarda las certificaciones vigentes del transportista al despachar.
    Todo en una sola transacción: salida + salida_certificaciones + hito.
    """
    salida = _obtener_salida_o_error(db, salida_id)
    _exigir_transicion(salida, ESTADO_DESPACHADO)

    if salida.lote.retirado:
        raise exceptions.LoteRetirado()

    hoy_ar = hoy()
    if salida.lote.fecha_vencimiento is not None and salida.lote.fecha_vencimiento < hoy_ar:
        raise exceptions.LoteVencidoError()

    if fecha_despacho < salida.fecha_reserva:
        raise exceptions.FechaInvalida(
            "La fecha de despacho no puede ser anterior a la fecha de reserva."
        )
    if fecha_despacho > hoy_ar:
        raise exceptions.FechaInvalida(
            "La fecha de despacho no puede ser posterior a hoy."
        )

    if forma_entrega not in (
        FORMA_ENTREGA_CON_TRANSPORTISTA,
        FORMA_ENTREGA_RETIRA_CLIENTE,
    ):
        raise exceptions.FechaInvalida("Forma de entrega inválida.")

    if forma_entrega == FORMA_ENTREGA_CON_TRANSPORTISTA:
        if transportista_id is None:
            raise exceptions.TransportistaRequerido()
        transportista = _obtener_transportista_o_error(db, transportista_id)
        if not transportista.activo:
            raise exceptions.TransportistaInactivo()
        habilitacion = estado_habilitacion(
            transportista.certificaciones, fecha_referencia=hoy_ar
        )
        if habilitacion != ESTADO_HABILITADO:
            raise exceptions.TransportistaNoHabilitado()
    else:
        if transportista_id is not None:
            raise exceptions.TransportistaNoPermitido()
        transportista = None

    salida.forma_entrega = forma_entrega
    salida.transportista_id = transportista_id if transportista else None
    salida.fecha_despacho = fecha_despacho
    salida.despachado_en = ahora()
    salida.estado = ESTADO_DESPACHADO

    # Guardar certificaciones vigentes del transportista al despachar.
    if transportista is not None:
        for cert in transportista.certificaciones:
            if cert.activa and not cert.anulada:
                db.add(
                    SalidaCertificacion(
                        salida_id=salida.id,
                        certificacion_id=cert.id,
                    )
                )

    db.add(salida)
    db.flush()
    try:
        unidad = (
            salida.lote.producto.unidad_medida.simbolo
            if salida.lote.producto and salida.lote.producto.unidad_medida
            else ""
        )
        descripcion = (
            f"Despacho de {formatear_cantidad(salida.cantidad)} {unidad} "
            f"para {salida.cliente.nombre}."
        )
        if transportista is not None:
            descripcion += (
                f" Transportista: {transportista.razon_social} "
                f"(CUIT {transportista.cuit})."
            )
        registrar_hito(
            db,
            lote_id=salida.lote_id,
            tipo_evento=TIPO_EVENTO_DESPACHO,
            descripcion=descripcion,
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def entregar(
    db: Session,
    salida_id: int,
    fecha_entrega: date,
    observacion: str | None,
    usuario: Personal,
    recibido_por: str | None = None,
) -> Salida:
    """Marca una salida despachada como ENTREGADO.

    Validaciones:
    - La salida existe y está en DESPACHADO.
    - fecha_entrega no anterior a fecha_despacho y no posterior a hoy.

    Todo en una sola transacción: salida + hito.
    """
    salida = _obtener_salida_o_error(db, salida_id)
    _exigir_transicion(salida, ESTADO_ENTREGADO)

    hoy_ar = hoy()
    if salida.fecha_despacho is not None and fecha_entrega < salida.fecha_despacho:
        raise exceptions.FechaInvalida(
            "La fecha de entrega no puede ser anterior a la fecha de despacho."
        )
    if fecha_entrega > hoy_ar:
        raise exceptions.FechaInvalida(
            "La fecha de entrega no puede ser posterior a hoy."
        )

    recibido_por = (recibido_por or "").strip() or None
    if recibido_por is not None and len(recibido_por) > 100:
        raise exceptions.FechaInvalida(
            "El nombre de quien recibió no puede superar los 100 caracteres."
        )

    salida.fecha_entrega = fecha_entrega
    salida.entregado_en = ahora()
    salida.observacion_entrega = observacion
    salida.recibido_por = recibido_por
    salida.estado = ESTADO_ENTREGADO

    db.add(salida)
    db.flush()
    try:
        unidad = (
            salida.lote.producto.unidad_medida.simbolo
            if salida.lote.producto and salida.lote.producto.unidad_medida
            else ""
        )
        quien_recibio = f". Recibió: {recibido_por}." if recibido_por else "."
        descripcion = (
            f"Entrega de {formatear_cantidad(salida.cantidad)} {unidad} "
            f"para {salida.cliente.nombre}.{quien_recibio}"
        )
        if salida.forma_entrega == FORMA_ENTREGA_RETIRA_CLIENTE:
            quien_retiro = f". Retiró: {recibido_por}." if recibido_por else "."
            descripcion = (
                f"Retiro en planta confirmado por {salida.cliente.nombre}.{quien_retiro}"
            )
        registrar_hito(
            db,
            lote_id=salida.lote_id,
            tipo_evento=TIPO_EVENTO_ENTREGA,
            descripcion=descripcion,
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def _cancelar_sin_commit(
    db: Session,
    salida: Salida,
    motivo: str,
    usuario: Personal,
) -> None:
    """Cancela una salida RESERVADO sin hacer commit.

    Se usa desde el endpoint público `cancelar` y desde `iniciar_retiro`
    (retiros) para mantener la atomicidad de la transacción mayor.
    """
    salida.motivo_cancelacion = motivo
    salida.cancelada_por_id = usuario.id
    salida.fecha_cancelacion = ahora()
    salida.estado = ESTADO_CANCELADO

    db.add(salida)
    db.flush()

    unidad = (
        salida.lote.producto.unidad_medida.simbolo
        if salida.lote.producto and salida.lote.producto.unidad_medida
        else ""
    )
    descripcion = (
        f"Cancelación de reserva de {formatear_cantidad(salida.cantidad)} {unidad} "
        f"para {salida.cliente.nombre}. Motivo: {motivo} "
        f"(usuario: {usuario.nombre} {usuario.apellido or ''})."
    )
    registrar_hito(
        db,
        lote_id=salida.lote_id,
        tipo_evento=TIPO_EVENTO_CANCELACION,
        descripcion=descripcion,
        usuario_id=usuario.id,
        salida_id=salida.id,
    )


def cancelar(
    db: Session,
    salida_id: int,
    motivo: str,
    usuario: Personal,
) -> Salida:
    """Cancela una reserva en estado RESERVADO.

    Validaciones:
    - La salida existe y está en RESERVADO.
    - motivo obligatorio.

    Pasa a CANCELADO. La cantidad vuelve al saldo del lote automáticamente
    (el saldo se calcula a partir de las salidas no canceladas).
    Todo en una sola transacción: salida + hito.
    """
    salida = _obtener_salida_o_error(db, salida_id)
    _exigir_transicion(salida, ESTADO_CANCELADO)

    motivo = (motivo or "").strip()
    if not motivo:
        raise exceptions.MotivoRequerido()

    _cancelar_sin_commit(db, salida, motivo, usuario)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def rechazar(
    db: Session,
    salida_id: int,
    motivo: str,
    detalle: str | None,
    fecha_rechazo: date,
    usuario: Personal,
    foto_url: str | None = None,
) -> Salida:
    """Registra que el cliente rechazó una entrega (Historia A).

    Validaciones:
    - La salida existe y está en DESPACHADO.
    - El motivo pertenece a la lista fija y el detalle es obligatorio para
      "otro".
    - fecha_rechazo no anterior al despacho ni posterior a hoy.
    - Se permite rechazar aunque el lote esté retirado o vencido: se registra
      lo que ocurrió.

    Abre un incidente "Entrega rechazada" vinculado al lote y a la salida,
    pasa la salida a RECHAZADA (la cantidad queda en revisión, sin volver al
    saldo) y registra el hito. Todo en UNA transacción.
    """
    salida = _obtener_salida_o_error(db, salida_id)
    _exigir_transicion(salida, ESTADO_RECHAZADA)

    motivo = (motivo or "").strip()
    if motivo not in MOTIVOS_RECHAZO:
        raise exceptions.MotivoRechazoInvalido()

    detalle = (detalle or "").strip()
    if motivo == MOTIVO_RECHAZO_OTRO and not detalle:
        raise exceptions.DetalleRechazoRequerido()
    if len(detalle) > 500:
        raise exceptions.DetalleRechazoDemasiadoLargo()

    hoy_ar = hoy()
    if salida.fecha_despacho is not None and fecha_rechazo < salida.fecha_despacho:
        raise exceptions.FechaRechazoInvalida()
    if fecha_rechazo > hoy_ar:
        raise exceptions.FechaRechazoInvalida()

    unidad = (
        salida.lote.producto.unidad_medida.simbolo
        if salida.lote.producto and salida.lote.producto.unidad_medida
        else ""
    )
    etiqueta_motivo = ETIQUETAS_MOTIVO_RECHAZO.get(motivo, motivo)

    descripcion_incidente = (
        f"El cliente {salida.cliente.nombre} rechazó la entrega de "
        f"{formatear_cantidad(salida.cantidad)} {unidad} del lote "
        f"{salida.lote.numero_lote} ({salida.lote.producto.nombre}). "
        f"Motivo: {etiqueta_motivo}."
    )
    if detalle:
        descripcion_incidente += f" Detalle: {detalle}."

    incidente = incidente_services.crear_incidente_vinculado(
        db,
        titulo=f"Entrega rechazada · Lote {salida.lote.numero_lote}"[:60],
        descripcion=descripcion_incidente,
        tipo=TipoIncidente.ENTREGA_RECHAZADA.value,
        usuario_id=usuario.id,
        foto_url=foto_url,
        lote_id=salida.lote_id,
        salida_id=salida.id,
    )

    salida.motivo_rechazo = motivo
    salida.detalle_rechazo = detalle or None
    salida.fecha_rechazo = fecha_rechazo
    salida.rechazada_por_id = usuario.id
    salida.incidente_id = incidente.id
    salida.estado = ESTADO_RECHAZADA

    db.add(salida)
    db.flush()
    try:
        registrar_hito(
            db,
            lote_id=salida.lote_id,
            tipo_evento=TIPO_EVENTO_RECHAZO,
            descripcion=(
                f"Entrega rechazada por {salida.cliente.nombre}: "
                f"{etiqueta_motivo}. "
                f"{formatear_cantidad(salida.cantidad)} {unidad} en revisión."
            ),
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def resolver_rechazo(
    db: Session,
    salida_id: int,
    disposicion: str,
    justificacion: str,
    usuario: Personal,
) -> Salida:
    """Resuelve un rechazo: reingresa la mercadería al lote o la desecha.

    - La salida debe estar en RECHAZADA y sin disposición; una vez decidida no
      se puede modificar.
    - La justificación es obligatoria.
    - REINGRESADA solo se permite si el lote no está vencido ni retirado.
    - Cierra el incidente vinculado reutilizando la lógica de cierre de
      incidentes y registra el hito. Todo en UNA transacción. El estado de la
      salida NO cambia: la decisión vive en los campos de disposición.
    """
    salida = _obtener_salida_o_error(db, salida_id)

    if salida.estado != ESTADO_RECHAZADA:
        raise exceptions.TransicionInvalida(
            f"La salida está en '{salida.estado}' y no tiene un rechazo pendiente."
        )
    if salida.disposicion is not None:
        raise exceptions.RechazoYaResuelto()

    disposicion = (disposicion or "").strip().upper()
    if disposicion not in DISPOSICIONES:
        raise exceptions.DisposicionInvalida()

    justificacion = (justificacion or "").strip()
    if not justificacion:
        raise exceptions.JustificacionRequerida()
    if len(justificacion) > 500:
        raise exceptions.JustificacionDemasiadoLarga()

    lote = salida.lote
    if disposicion == DISPOSICION_REINGRESADA:
        if lote.retirado:
            raise exceptions.ReingresoNoPermitidoLoteRetirado()
        if lote.fecha_vencimiento is not None and lote.fecha_vencimiento < hoy():
            raise exceptions.ReingresoNoPermitidoLoteVencido()

    salida.disposicion = disposicion
    salida.justificacion_disposicion = justificacion
    salida.fecha_disposicion = ahora()
    salida.decidida_por_id = usuario.id

    accion = (
        "reingresada al lote"
        if disposicion == DISPOSICION_REINGRESADA
        else "desechada"
    )
    detalle_accion = f"Rechazo resuelto: {accion}. Justificación: {justificacion}."

    # Cerrar el incidente vinculado con la acción correctiva, sin duplicar la
    # lógica de cierre. Si por algún motivo ya no existe, el hito se registra
    # igual: la decisión quedó asentada en la salida.
    if salida.incidente_id is not None:
        incidente = db.get(Incidente, salida.incidente_id)
        if incidente is not None:
            incidente_services.cerrar_incidente(
                db, incidente, usuario, observacion_cierre=detalle_accion
            )

    db.add(salida)
    db.flush()
    try:
        registrar_hito(
            db,
            lote_id=salida.lote_id,
            tipo_evento=TIPO_EVENTO_DISPOSICION,
            descripcion=detalle_accion,
            usuario_id=usuario.id,
            salida_id=salida.id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(salida)
    return salida


def listar_salidas(
    db: Session,
    estado: str | None = None,
    lote_id: int | None = None,
    cliente_id: int | None = None,
) -> list[Salida]:
    """Lista salidas con filtros opcionales, ordenadas por fecha descendente.

    Carga lote, producto, cliente, usuario y certificaciones (selectinload)
    para evitar N+1.
    """
    consulta = select(Salida).options(
        selectinload(Salida.lote).selectinload(LoteProducto.producto),
        selectinload(Salida.cliente),
        selectinload(Salida.creado_por),
        selectinload(Salida.transportista),
        selectinload(Salida.cancelada_por),
        selectinload(Salida.rechazada_por),
        selectinload(Salida.decidida_por),
        selectinload(Salida.incidente),
        selectinload(Salida.reclamos).selectinload(Reclamo.incidente),
        selectinload(Salida.certificaciones).selectinload(
            SalidaCertificacion.certificacion
        ),
    )

    if estado is not None:
        consulta = consulta.where(Salida.estado == estado)
    if lote_id is not None:
        consulta = consulta.where(Salida.lote_id == lote_id)
    if cliente_id is not None:
        consulta = consulta.where(Salida.cliente_id == cliente_id)

    consulta = consulta.order_by(Salida.fecha_reserva.desc(), Salida.id.desc())
    return list(db.scalars(consulta).all())


def salida_a_resumen(
    salida: Salida, db: Session | None = None
) -> schemas.SalidaResumen:
    creado_por_nombre = None
    if salida.creado_por is not None:
        creado_por_nombre = (
            f"{salida.creado_por.nombre} {salida.creado_por.apellido or ''}".strip()
        )
    cancelada_por_nombre = None
    if salida.cancelada_por is not None:
        cancelada_por_nombre = (
            f"{salida.cancelada_por.nombre} {salida.cancelada_por.apellido or ''}".strip()
        )
    transportista_nombre = None
    if salida.transportista is not None:
        transportista_nombre = salida.transportista.razon_social

    rechazada_por_nombre = None
    if salida.rechazada_por is not None:
        rechazada_por_nombre = (
            f"{salida.rechazada_por.nombre} {salida.rechazada_por.apellido or ''}".strip()
        )
    decidida_por_nombre = None
    if salida.decidida_por is not None:
        decidida_por_nombre = (
            f"{salida.decidida_por.nombre} {salida.decidida_por.apellido or ''}".strip()
        )

    incidente = salida.incidente

    certificaciones = []
    for sc in (salida.certificaciones or []):
        cert = sc.certificacion
        if cert is not None:
            certificaciones.append(
                schemas.SalidaCertificacionResumen(
                    id=cert.id,
                    tipo=cert.tipo,
                    numero=cert.numero,
                    fecha_vencimiento=cert.fecha_vencimiento,
                    activa=cert.activa,
                )
            )

    reclamos = [
        schemas.SalidaReclamoResumen(
            id=r.id,
            fecha_reclamo=r.fecha_reclamo,
            motivo=r.motivo,
            motivo_label=ETIQUETAS_MOTIVO_RECLAMO.get(r.motivo),
            incidente_estado=r.incidente.estado if r.incidente is not None else None,
            fuera_de_plazo=r.fuera_de_plazo,
        )
        for r in sorted(
            (salida.reclamos or []),
            key=lambda r: (r.fecha_reclamo, r.id),
            reverse=True,
        )
    ]

    # Retiro asociado al lote (si existe y se pide con db).
    retiro_id = None
    retiro_estado = None
    if db is not None:
        from src.retiros.models import Retiro

        retiro = db.scalar(
            select(Retiro).where(Retiro.lote_id == salida.lote_id)
        )
        if retiro is not None:
            retiro_id = retiro.id
            retiro_estado = retiro.estado

    return schemas.SalidaResumen(
        id=salida.id,
        lote_id=salida.lote_id,
        lote_numero=salida.lote.numero_lote,
        producto_nombre=salida.lote.producto.nombre,
        unidad_medida=salida.lote.producto.unidad_medida.simbolo,
        cliente_id=salida.cliente_id,
        cliente_nombre=salida.cliente.nombre,
        cliente_contacto=salida.cliente.telefono,
        cliente_domicilio=salida.cliente.domicilio,
        cantidad=salida.cantidad,
        fecha_reserva=salida.fecha_reserva,
        fecha_vencimiento=salida.lote.fecha_vencimiento.isoformat() if salida.lote.fecha_vencimiento else None,
        fecha_elaboracion=(
            salida.lote.fecha_inicio.date() if salida.lote.fecha_inicio else None
        ),
        estado=salida.estado,
        creado_por_id=salida.creado_por_id,
        creado_por_nombre=creado_por_nombre,
        creado_en=salida.creado_en.isoformat() if salida.creado_en else None,
        forma_entrega=salida.forma_entrega,
        transportista_id=salida.transportista_id,
        transportista_nombre=transportista_nombre,
        fecha_despacho=salida.fecha_despacho,
        fecha_entrega=salida.fecha_entrega,
        despachado_en=(
            salida.despachado_en.isoformat() if salida.despachado_en else None
        ),
        entregado_en=(
            salida.entregado_en.isoformat() if salida.entregado_en else None
        ),
        observacion_entrega=salida.observacion_entrega,
        motivo_cancelacion=salida.motivo_cancelacion,
        cancelada_por_nombre=cancelada_por_nombre,
        fecha_cancelacion=(
            salida.fecha_cancelacion.isoformat() if salida.fecha_cancelacion else None
        ),
        recibido_por=salida.recibido_por,
        motivo_rechazo=salida.motivo_rechazo,
        motivo_rechazo_label=(
            ETIQUETAS_MOTIVO_RECHAZO.get(salida.motivo_rechazo)
            if salida.motivo_rechazo
            else None
        ),
        detalle_rechazo=salida.detalle_rechazo,
        fecha_rechazo=salida.fecha_rechazo,
        rechazada_por_nombre=rechazada_por_nombre,
        disposicion=salida.disposicion,
        justificacion_disposicion=salida.justificacion_disposicion,
        fecha_disposicion=(
            salida.fecha_disposicion.isoformat()
            if salida.fecha_disposicion
            else None
        ),
        decidida_por_nombre=decidida_por_nombre,
        incidente_id=salida.incidente_id,
        incidente_estado=incidente.estado if incidente is not None else None,
        incidente_foto_url=incidente.foto_url if incidente is not None else None,
        lote_retirado=bool(salida.lote.retirado),
        retiro_id=retiro_id,
        retiro_estado=retiro_estado,
        certificaciones=certificaciones,
        reclamos=reclamos,
    )


def obtener_salida(db: Session, salida_id: int) -> Salida:
    """Obtiene una salida por su ID, cargando todas las relaciones."""
    stmt = (
        select(Salida)
        .options(
            selectinload(Salida.lote).selectinload(LoteProducto.producto),
            selectinload(Salida.cliente),
            selectinload(Salida.creado_por),
            selectinload(Salida.transportista),
            selectinload(Salida.cancelada_por),
            selectinload(Salida.rechazada_por),
            selectinload(Salida.decidida_por),
            selectinload(Salida.incidente),
            selectinload(Salida.reclamos).selectinload(Reclamo.incidente),
            selectinload(Salida.certificaciones).selectinload(
                SalidaCertificacion.certificacion
            ),
        )
        .where(Salida.id == salida_id)
    )
    salida = db.scalar(stmt)
    if salida is None:
        raise exceptions.SalidaNoEncontrada()
    return salida


def calcular_cantidades_lote(db: Session, lote_id: int) -> dict:
    """Devuelve reservado, despachado, entregado, saldo y estado_lote de un lote."""
    lote = _obtener_lote_o_error(db, lote_id)
    salidas = list(lote.salidas) if lote.salidas is not None else []
    return calcular_cantidades(lote.cantidad_producida, salidas, lote.retirado)


def obtener_clientes_disponibles(db: Session) -> list[schemas.ClienteDisponible]:
    """Clientes activos para elegir al reservar una salida (puede_operar).

    Solo lectura: se devuelven los que están dados de alta, ordenados por nombre.
    """
    clientes = db.scalars(
        select(Cliente)
        .where(Cliente.activo.is_(True))
        .order_by(Cliente.nombre.asc(), Cliente.id.asc())
    ).all()
    return [schemas.ClienteDisponible(id=c.id, nombre=c.nombre) for c in clientes]


def obtener_lotes_disponibles(db: Session) -> list[schemas.LoteDisponible]:
    """Lotes con saldo > 0 para elegir al reservar una salida (puede_operar).

    Solo lectura: se calcula el saldo real a partir de las salidas registradas
    y se devuelven solo los que aún tienen mercadería disponible, ordenados
    por código de lote.
    """
    lotes = db.scalars(
        select(LoteProducto)
        .options(
            selectinload(LoteProducto.producto),
            selectinload(LoteProducto.salidas),
        )
        .order_by(LoteProducto.numero_lote.asc())
    ).all()

    disponibles: list[schemas.LoteDisponible] = []
    for lote in lotes:
        producto = lote.producto
        unidad_medida = (
            producto.unidad_medida.simbolo
            if producto is not None and producto.unidad_medida is not None
            else ""
        )
        salidas = list(lote.salidas) if lote.salidas is not None else []
        calculo = calcular_cantidades(lote.cantidad_producida, salidas, lote.retirado)
        if not lote.retirado and calculo["saldo"] > 0:
            disponibles.append(
                schemas.LoteDisponible(
                    id=lote.id,
                    codigo=lote.numero_lote,
                    producto_nombre=producto.nombre if producto is not None else "Sin producto",
                    unidad_medida=unidad_medida,
                    saldo=float(calculo["saldo"]),
                    fecha_inicio=lote.fecha_inicio.date() if lote.fecha_inicio else None,
                    fecha_vencimiento=lote.fecha_vencimiento,
                    retirado=lote.retirado,
                    retiro_id=None,
                )
            )
    return disponibles
