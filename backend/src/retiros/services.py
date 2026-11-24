"""Servicio del dominio de retiros de lote (Historia 21).

Todas las funciones de este módulo operan SIN `commit()` propio: el caller
(Endpoint) controla la transacción y hace el `commit()` final. Esto garantiza
atomicidad cuando se combinan varias operaciones (lote + salidas + incidente +
hitos) en una sola transacción.
"""

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.clientes.models import Cliente
from src.common.fechas import ahora, hoy
from src.exceptions import BadRequest, NotFound
from src.incidente import services as incidente_services
from src.incidente.models import Incidente
from src.lotes.models import LoteProducto
from src.lotesInsumo.models import LoteInsumo
from src.personal.models import Personal
from src.reclamos.models import Reclamo
from src.reposiciones.services import crear_reposicion_por_reserva_cancelada
from src.retiros import exceptions, schemas
from src.retiros.constants import (
    ESTADO_NOTIFICACION_NOTIFICADO,
    ESTADO_NOTIFICACION_PENDIENTE,
    ESTADO_RETIRO_CERRADO,
    ESTADO_RETIRO_EN_CURSO,
    MEDIOS_CONTACTO_RETIRO,
    MOTIVOS_RETIRO,
    ORIGEN_RETIRO_INSUMO,
    ORIGEN_RETIRO_MANUAL,
    ORIGEN_RETIRO_RECLAMO,
    TIPO_EVENTO_CIERRE_RETIRO,
    TIPO_EVENTO_NOTIFICACION_RETIRO,
    TIPO_EVENTO_RETIRO,
    TIPO_INCIDENTE_RETIRO_LOTE,
)
from src.retiros.models import Retiro, RetiroAfectado
from src.salidas import services as salidas_services
from src.salidas.constants import (
    ESTADO_DESPACHADO,
    ESTADO_ENTREGADO,
    ESTADO_RESERVADO,
)
from src.salidas.models import Salida, calcular_cantidades, formatear_cantidad


def _nombre_completo(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


# ---------------------------------------------------------------------------
# Alta de retiro (sin commit)
# ---------------------------------------------------------------------------

def iniciar_retiro(
    db: Session,
    lote_id: int,
    motivo: str,
    detalle: Optional[str],
    fecha_retiro: date,
    usuario: Personal,
    origen: Optional[str] = None,
    reclamo_id: Optional[int] = None,
) -> Retiro:
    """Inicia un retiro de lote del mercado en una sola transacción (sin commit).

    Valida el lote, marca `retirado=True`, cancela reservas activas,
    crea filas de `RetiroAfectado` para despachos/entregas, crea el incidente
    de tipo `retiro_lote` y registra el hito `RETIRO`. Todo sin commitear:
    el caller hace el `commit()` final.
    """
    # 1. Validar que el lote exista
    lote = db.get(LoteProducto, lote_id)
    if lote is None:
        from src.lotes import exceptions as lotes_exceptions

        raise lotes_exceptions.LoteNoEncontrado()

    # 2. Validar que no esté ya retirado
    if lote.retirado:
        raise exceptions.LoteYaRetirado()

    # 3. Validar motivo
    motivo = (motivo or "").strip()
    if motivo not in MOTIVOS_RETIRO:
        raise exceptions.RetiroMotivoInvalido()

    # 4. Validar detalle cuando el motivo es "Otro"
    detalle = (detalle or "").strip() or None
    if motivo == "Otro" and not detalle:
        raise exceptions.RetiroMotivoInvalido()

    # 5. Validar fecha de retiro
    hoy_ar = hoy()
    if fecha_retiro > hoy_ar:
        raise exceptions.RetiroFechaInvalida()
    if lote.fecha_inicio is not None and fecha_retiro < lote.fecha_inicio.date():
        raise exceptions.RetiroFechaInvalida()

    # 6. Determinar origen y validar reclamo_id si viene
    if reclamo_id is not None:
        reclamo = db.scalar(select(Reclamo).where(Reclamo.id == reclamo_id))
        if reclamo is None:
            raise exceptions.ReclamoNoCorrespondeAlLote()
        if reclamo.lote_id != lote_id:
            raise exceptions.ReclamoNoCorrespondeAlLote()

    if origen:
        origen_retiro = origen
    elif reclamo_id is not None:
        origen_retiro = ORIGEN_RETIRO_RECLAMO
    else:
        origen_retiro = ORIGEN_RETIRO_MANUAL

    # 7. Marcar el lote como retirado (irreversible)
    lote.retirado = True
    db.add(lote)

    # 8. Crear el retiro (flush para obtener el id sin commitear: lo necesitan
    #    las reposiciones y los afectados que se vinculan a continuación)
    retiro = Retiro(
        lote_id=lote_id,
        motivo=motivo,
        detalle=detalle,
        fecha_retiro=fecha_retiro,
        iniciado_por_id=usuario.id,
        fecha_registro=ahora(),
        estado=ESTADO_RETIRO_EN_CURSO,
        origen=origen_retiro,
        reclamo_id=reclamo_id,
    )
    db.add(retiro)
    db.flush()

    # 9. Cancelar reservas (RESERVADO) del lote y generar la reposición
    #    comercial (deuda de stock con el cliente) por cada una.
    salidas = list(lote.salidas) if lote.salidas is not None else []
    salidas_reservadas = [s for s in salidas if s.estado == ESTADO_RESERVADO]
    for salida in salidas_reservadas:
        salidas_services._cancelar_sin_commit(
            db, salida, f"Retiro del lote: {motivo}", usuario
        )
        crear_reposicion_por_reserva_cancelada(db, salida, retiro.id)

    # 10. Crear filas de RetiroAfectado para DESPACHADO y ENTREGADO
    salidas_afectadas = [
        s for s in salidas if s.estado in (ESTADO_DESPACHADO, ESTADO_ENTREGADO)
    ]
    afectados_creados: list[RetiroAfectado] = []
    for salida in salidas_afectadas:
        afectado = RetiroAfectado(
            retiro_id=retiro.id,
            salida_id=salida.id,
            estado_notificacion=ESTADO_NOTIFICACION_PENDIENTE,
        )
        db.add(afectado)
        afectados_creados.append(afectado)

    # 11. Crear el incidente de tipo "retiro_lote" (inmutable en E6)
    n_reservas = len(salidas_reservadas)
    n_entregas = len(salidas_afectadas)
    unidad = (
        lote.producto.unidad_medida.simbolo
        if lote.producto and lote.producto.unidad_medida
        else ""
    )
    descripcion_incidente = (
        f"Retiro de lote {lote.numero_lote} ({lote.producto.nombre}). "
        f"Motivo: {motivo}. "
        f"{n_reservas} reserva(s) cancelada(s), {n_entregas} entrega(s) a notificar."
    )
    incidente = incidente_services.crear_incidente_vinculado(
        db,
        titulo=f"Retiro de lote · {lote.numero_lote}"[:60],
        descripcion=descripcion_incidente,
        tipo=TIPO_INCIDENTE_RETIRO_LOTE,
        usuario_id=usuario.id,
        lote_id=lote_id,
    )
    retiro.incidente_id = incidente.id
    db.add(retiro)

    # 12. Registrar hito RETIRO en el lote
    descripcion_hito = (
        f"Lote retirado del mercado: {motivo}. "
        f"{n_reservas} reserva(s) cancelada(s), {n_entregas} entrega(s) a notificar."
    )
    salidas_services.registrar_hito(
        db,
        lote_id=lote_id,
        tipo_evento=TIPO_EVENTO_RETIRO,
        descripcion=descripcion_hito,
        usuario_id=usuario.id,
    )

    return retiro


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def obtener_retiro(db: Session, retiro_id: int) -> Retiro:
    retiro = db.scalar(
        select(Retiro)
        .options(
            selectinload(Retiro.iniciado_por),
            selectinload(Retiro.cerrado_por),
            selectinload(Retiro.afectados).selectinload(RetiroAfectado.salida).selectinload(Salida.cliente),
            selectinload(Retiro.afectados).selectinload(RetiroAfectado.salida).selectinload(Salida.transportista),
            selectinload(Retiro.afectados).selectinload(RetiroAfectado.notificado_por),
        )
        .where(Retiro.id == retiro_id)
    )
    if retiro is None:
        raise exceptions.RetiroNoEncontrado()
    return retiro


def listar_retiros(
    db: Session,
    lote_id: Optional[int] = None,
    estado: Optional[str] = None,
    incidente_id: Optional[int] = None,
) -> list[Retiro]:
    consulta = select(Retiro).options(
        selectinload(Retiro.iniciado_por),
        selectinload(Retiro.afectados),
    )
    if lote_id is not None:
        consulta = consulta.where(Retiro.lote_id == lote_id)
    if estado is not None:
        consulta = consulta.where(Retiro.estado == estado)
    if incidente_id is not None:
        consulta = consulta.where(Retiro.incidente_id == incidente_id)
    consulta = consulta.order_by(Retiro.fecha_retiro.desc(), Retiro.id.desc())
    return list(db.scalars(consulta).all())


# ---------------------------------------------------------------------------
# Notificar afectado
# ---------------------------------------------------------------------------

def notificar_afectado(
    db: Session,
    retiro_id: int,
    afectado_id: int,
    fecha_notificacion: date,
    medio_contacto: Optional[str],
    observacion: Optional[str],
    usuario: Personal,
) -> RetiroAfectado:
    retiro = obtener_retiro(db, retiro_id)
    if retiro.estado != ESTADO_RETIRO_EN_CURSO:
        raise exceptions.RetiroYaCerrado()

    afectado = db.scalar(
        select(RetiroAfectado).where(
            RetiroAfectado.id == afectado_id,
            RetiroAfectado.retiro_id == retiro_id,
        )
    )
    if afectado is None:
        raise exceptions.RetiroNoEncontrado()

    if afectado.estado_notificacion != ESTADO_NOTIFICACION_PENDIENTE:
        raise exceptions.AfectadoYaNotificado()

    hoy_ar = hoy()
    if fecha_notificacion < retiro.fecha_retiro or fecha_notificacion > hoy_ar:
        raise exceptions.RetiroFechaInvalida()

    if medio_contacto is not None:
        medio_contacto = (medio_contacto or "").strip()
        if medio_contacto and medio_contacto not in MEDIOS_CONTACTO_RETIRO:
            raise exceptions.MedioContactoInvalido()
    else:
        medio_contacto = None

    observacion = (observacion or "").strip() or None

    afectado.estado_notificacion = ESTADO_NOTIFICACION_NOTIFICADO
    afectado.fecha_notificacion = fecha_notificacion
    afectado.medio_contacto = medio_contacto
    afectado.observacion = observacion
    afectado.notificado_por_id = usuario.id
    db.add(afectado)
    db.flush()

    salida = afectado.salida
    cliente = salida.cliente
    descripcion_hito = (
        f"Cliente {cliente.nombre} notificado del retiro del lote"
    )
    salidas_services.registrar_hito(
        db,
        lote_id=retiro.lote_id,
        tipo_evento=TIPO_EVENTO_NOTIFICACION_RETIRO,
        descripcion=descripcion_hito,
        usuario_id=usuario.id,
    )

    return afectado


# ---------------------------------------------------------------------------
# Cerrar retiro
# ---------------------------------------------------------------------------

def cerrar_retiro(
    db: Session,
    retiro_id: int,
    accion_correctiva: str,
    usuario: Personal,
) -> Retiro:
    retiro = obtener_retiro(db, retiro_id)
    if retiro.estado != ESTADO_RETIRO_EN_CURSO:
        raise exceptions.RetiroYaCerrado()

    # Verificar que no queden afectados pendientes
    pendientes = db.scalar(
        select(RetiroAfectado)
        .where(
            RetiroAfectado.retiro_id == retiro_id,
            RetiroAfectado.estado_notificacion == ESTADO_NOTIFICACION_PENDIENTE,
        )
    )
    if pendientes is not None:
        raise exceptions.AfectadosPendientes()

    accion_correctiva = (accion_correctiva or "").strip()
    if not accion_correctiva:
        raise exceptions.RetiroYaCerrado()

    # Cerrar el retiro
    retiro.estado = ESTADO_RETIRO_CERRADO
    retiro.fecha_cierre = ahora()
    retiro.cerrado_por_id = usuario.id
    retiro.accion_correctiva = accion_correctiva
    db.add(retiro)
    db.flush()

    # Cerrar el incidente vinculado usando el mismo camino interno que
    # "Resolver rechazo" (llamar directamente a cerrar_incidente, sin commit).
    if retiro.incidente_id is not None:
        incidente = db.get(Incidente, retiro.incidente_id)
        if incidente is not None:
            incidente_services.cerrar_incidente(
                db, incidente, usuario, observacion_cierre=accion_correctiva
            )

    # Registrar hito CIERRE_RETIRO
    descripcion_hito = f"Retiro de lote cerrado. Acción correctiva: {accion_correctiva}."
    salidas_services.registrar_hito(
        db,
        lote_id=retiro.lote_id,
        tipo_evento=TIPO_EVENTO_CIERRE_RETIRO,
        descripcion=descripcion_hito,
        usuario_id=usuario.id,
    )

    return retiro


# ---------------------------------------------------------------------------
# Serialización
# ---------------------------------------------------------------------------

def _cantidad_con_unidad(cantidad, unidad: Optional[str]) -> str:
    texto = formatear_cantidad(cantidad)
    if unidad:
        return f"{texto} {unidad}"
    return texto


def afectado_a_resumen(afectado: RetiroAfectado) -> schemas.RetiroAfectadoResumen:
    salida = afectado.salida
    cliente = salida.cliente
    transportista = salida.transportista
    unidad = (
        salida.lote.producto.unidad_medida.simbolo
        if salida.lote.producto and salida.lote.producto.unidad_medida
        else ""
    )
    return schemas.RetiroAfectadoResumen(
        id=afectado.id,
        salida_id=afectado.salida_id,
        cliente_id=cliente.id,
        cliente_nombre=cliente.nombre,
        cliente_telefono=cliente.telefono,
        cliente_email=cliente.email,
        cantidad_con_unidad=_cantidad_con_unidad(salida.cantidad, unidad),
        transportista=(
            transportista.razon_social if transportista else "Retira en planta"
        ),
        estado_salida=salida.estado,
        estado_notificacion=afectado.estado_notificacion,
        fecha_notificacion=afectado.fecha_notificacion,
        medio_contacto=afectado.medio_contacto,
        observacion=afectado.observacion,
        notificado_por=_nombre_completo(afectado.notificado_por),
    )


def retiro_a_resumen(retiro: Retiro) -> schemas.RetiroResumen:
    total_afectados = len(retiro.afectados) if retiro.afectados else 0
    notificados = sum(
        1 for a in (retiro.afectados or [])
        if a.estado_notificacion == ESTADO_NOTIFICACION_NOTIFICADO
    )
    return schemas.RetiroResumen(
        id=retiro.id,
        lote_id=retiro.lote_id,
        lote_codigo=retiro.lote.numero_lote,
        lote_producto_nombre=retiro.lote.producto.nombre,
        motivo=retiro.motivo,
        detalle=retiro.detalle,
        origen=retiro.origen,
        fecha_retiro=retiro.fecha_retiro,
        estado=retiro.estado,
        iniciado_por_nombre=_nombre_completo(retiro.iniciado_por),
        total_afectados=total_afectados,
        notificados=notificados,
    )


def retiro_a_detalle(retiro: Retiro) -> schemas.RetiroDetalle:
    lote = retiro.lote
    unidad = (
        lote.producto.unidad_medida.simbolo
        if lote.producto and lote.producto.unidad_medida
        else ""
    )
    calculo = calcular_cantidades(
        lote.cantidad_producida,
        list(lote.salidas) if lote.salidas is not None else [],
        lote.retirado,
    )
    incidente_estado = None
    if retiro.incidente_id is not None and retiro.afectados is not None:
        # El incidente se carga por separado si es necesario
        pass

    return schemas.RetiroDetalle(
        id=retiro.id,
        lote_id=retiro.lote_id,
        lote_codigo=lote.numero_lote,
        lote_producto_nombre=lote.producto.nombre,
        lote_unidad_medida=unidad,
        motivo=retiro.motivo,
        detalle=retiro.detalle,
        fecha_retiro=retiro.fecha_retiro,
        estado=retiro.estado,
        origen=retiro.origen,
        iniciado_por_nombre=_nombre_completo(retiro.iniciado_por),
        fecha_registro=retiro.fecha_registro,
        reclamo_id=retiro.reclamo_id,
        incidente_id=retiro.incidente_id,
        incidente_estado=(
            None  # se llena desde el endpoint si es necesario
        ),
        accion_correctiva=retiro.accion_correctiva,
        fecha_cierre=retiro.fecha_cierre,
        cerrado_por=_nombre_completo(retiro.cerrado_por),
        saldo_en_planta=_cantidad_con_unidad(calculo["saldo"], unidad),
        en_revision=_cantidad_con_unidad(calculo["en_revision"], unidad),
        afectados=[afectado_a_resumen(a) for a in (retiro.afectados or [])],
    )


def iniciar_retiro_masivo_insumo(
    db: Session,
    datos: schemas.RetiroMasivoInsumoCreate,
    usuario: Personal,
) -> schemas.RetiroMasivoResponse:
    # 1. Validar que exista el lote de insumo
    lote_insumo = db.get(LoteInsumo, datos.lote_insumo_id)
    if not lote_insumo:
        raise NotFound("El lote de insumo especificado no existe.")

    # 2. Desactivar el insumo si corresponde
    if datos.desactivar_insumo:
        lote_insumo.activo = False

    # 3. Iterar y ejecutar iniciar_retiro para cada lote_producto_id
    resultados = []
    detalle_extendido = (
        f"[Insumo: {lote_insumo.insumo.nombre} Lote #{lote_insumo.numero_lote}] "
        + (datos.detalle or "")
    ).strip()

    for lp_id in datos.lotes_producto_ids:
        # Verificar que el lote_producto exista y no esté ya retirado
        lote_prod = db.get(LoteProducto, lp_id)
        if not lote_prod:
            raise BadRequest(f"El lote de producto ID {lp_id} no existe.")
        if lote_prod.retirado or getattr(lote_prod, "retiro_id", None):
            raise BadRequest(f"El lote {lote_prod.numero_lote} ya se encuentra retirado del mercado.")

        # Reutilizar el servicio existente iniciar_retiro (que no hace commit interno)
        retiro = iniciar_retiro(
            db=db,
            lote_id=lp_id,
            motivo=datos.motivo,
            detalle=detalle_extendido,
            fecha_retiro=datos.fecha_retiro,
            usuario=usuario,
            origen=ORIGEN_RETIRO_INSUMO,
        )
        # Contar afectados
        afectados_count = len(retiro.afectados)
        resultados.append(
            schemas.RetiroMasivoResultadoItem(
                lote_id=lote_prod.id,
                numero_lote=lote_prod.numero_lote,
                retiro_id=retiro.id,
                clientes_afectados_count=afectados_count,
            )
        )

    return schemas.RetiroMasivoResponse(
        mensaje=f"Se iniciaron exitosamente {len(resultados)} retiros de producto.",
        lote_insumo_id=datos.lote_insumo_id,
        insumo_desactivado=datos.desactivar_insumo,
        retiros_creados=resultados,
    )

