from datetime import date as date_
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.common.fechas import hoy, ahora
from src.tareas.services import leer_tarea
from src.tareas.exceptions import TareaNoEncontrada
from src.checklist import exceptions
from src.checklist.exceptions import (
    ActualizacionConcurrente,
    CantidadConsumidaInvalida,
    ChecklistFuturo,
    ChecklistInmutable,
    TareaNoCorrespondeALaFecha,
    RegistroTareaNoEncontrado,
    ChecklistNoEncontrado,
)
from src.insumoQuimico.models import InsumoQuimico
from src.insumoQuimico.stock_services import sincronizar_consumo_checklist
from src.elementoLimpieza.models import ElementoLimpieza
from src.personal.models import Personal
from src.exceptions import PermissionDenied, BadRequest
from src.checklist.services.generacion import (
    _cerrar_checklist_vencido,
    _obtener_o_crear_checklist_de_plan,
    _tarea_corresponde_a_la_fecha,
)


def marcar_tarea(
    db: Session,
    tarea_id: int,
    completado: bool,
    usuario_id: int,
    usuario_nombre: str,
    evidencia_url: Optional[str],
    fecha: Optional[date_] = None,
    insumo_quimico_id: Optional[int] = None,
    cantidad_consumida: Optional[float] = None,
    elemento_limpieza_id: Optional[int] = None,
) -> models.RegistroTarea:

    if cantidad_consumida is not None and cantidad_consumida <= 0:
        raise CantidadConsumidaInvalida()
    if (insumo_quimico_id is None) != (cantidad_consumida is None):
        raise CantidadConsumidaInvalida()
    if completado and insumo_quimico_id is not None:
        insumo_validado = db.get(InsumoQuimico, insumo_quimico_id)
        if insumo_validado is None or not insumo_validado.activo:
            raise exceptions.InsumoQuimicoNoEncontrado()
    if completado and elemento_limpieza_id is not None:
        elemento_validado = db.get(ElementoLimpieza, elemento_limpieza_id)
        if elemento_validado is None or not elemento_validado.activo:
            raise exceptions.ElementoLimpiezaNoEncontrado()

    tarea = leer_tarea(db, tarea_id)
    if not tarea.activo or not tarea.plan.activo:
        raise TareaNoEncontrada()

    fecha_registro = fecha or hoy()
    hoy_val = hoy()

    # No se pueden modificar checklists futuros
    if fecha_registro > hoy_val:
        raise ChecklistFuturo()

    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.plan_id == tarea.plan.id,
            models.Checklist.fecha == fecha_registro,
        )
    )

    # Si todavía no existe el checklist, lo creamos
    if checklist is None:
        # Verificar que la tarea corresponde a la fecha solicitada
        if not _tarea_corresponde_a_la_fecha(tarea, fecha_registro):
            raise TareaNoCorrespondeALaFecha()
        tareas_del_dia = [
            t for t in tarea.plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_registro)
        ]
        checklist, _ = _obtener_o_crear_checklist_de_plan(
            db, tarea.plan, tareas_del_dia, fecha_registro, hoy_val
        )
    if checklist is None:
        # Si la tarea no corresponde a la fecha, no se crea checklist
        raise TareaNoCorrespondeALaFecha()

    # Los checklists de días anteriores son históricos
    # y no se pueden modificar.
    if checklist.fecha < hoy_val:
        if _cerrar_checklist_vencido(checklist, hoy_val):
            db.commit()

        raise ChecklistInmutable()

    # Buscamos el registro correspondiente a esta tarea
    registro = db.scalar(
        select(models.RegistroTarea).where(
            models.RegistroTarea.checklist_id == checklist.id,
            models.RegistroTarea.tarea_id == tarea.id,
        )
    )

    # Si por algún motivo todavía no existe, lo creamos
    if registro is None:
        registro = models.RegistroTarea(
            checklist_id=checklist.id,
            tarea_id=tarea.id,
            nombre_tarea_historico=tarea.nombre,
            descripcion_tarea_historico=tarea.descripcion,
            tipo_tarea_historico=tarea.tipo,
            observaciones_tarea_historico=tarea.observaciones,
            operador_id=tarea.operador_id,
        )

        db.add(registro)

        # Necesitamos el ID antes de registrar el historial
        db.flush()

    # ---------------------------------------------------------
    # VALIDACIÓN DE ASIGNACIÓN DE OPERADOR
    # ---------------------------------------------------------
    # Quién puede marcar esta tarea:
    # 1. Cualquier administrador / super admin.
    # 2. El operador asignado (operador_id == usuario_id).
    # 3. Quien la cubrió (reemplazado_por_id == usuario_id).
    # 4. Cualquier operador si la tarea no tiene asignado operador (operador_id IS NULL).
    current_user = db.get(Personal, usuario_id)
    if current_user is None:
        raise PermissionDenied("Usuario no encontrado.")

    puede_marcar = False
    if current_user.puede_administrar or current_user.es_super_admin:
        puede_marcar = True
    elif registro.operador_id is None:
        puede_marcar = True  # Tarea sin asignar: cualquier operador la toma
    elif registro.operador_id == usuario_id:
        puede_marcar = True
    elif registro.reemplazado_por_id == usuario_id:
        puede_marcar = True

    if not puede_marcar:
        operador_nombre = None
        if registro.operador_id is not None:
            op = db.get(Personal, registro.operador_id)
            if op is not None:
                operador_nombre = f"{op.nombre} {op.apellido or ''}".strip()
        raise PermissionDenied(
            f"Esta tarea está asignada a {operador_nombre or 'otro operador'} y no puede ser marcada por usted."
        )

    consumo_anterior = (
        registro.insumo_quimico_id,
        Decimal(str(registro.cantidad_consumida)) if registro.cantidad_consumida is not None else None,
    )

    version_anterior = registro.version_stock
    resultado_version = db.execute(
        update(models.RegistroTarea)
        .where(
            models.RegistroTarea.id == registro.id,
            models.RegistroTarea.version_stock == version_anterior,
        )
        .values(version_stock=version_anterior + 1)
    )
    if resultado_version.rowcount != 1:
        db.rollback()
        raise ActualizacionConcurrente()
    registro.version_stock = version_anterior + 1

    # Actualizamos el estado de la tarea
    registro.completado = completado

    # La autoría y el timestamp solo se escriben al completar: al desmarcar no
    # se pisa quién la había hecho, así el registro conserva el autor real.
    if completado:
        registro.fecha_completado = ahora()
        registro.usuario_id = usuario_id
        if evidencia_url:
            registro.evidencia_url = evidencia_url
    else:
        registro.fecha_completado = None
        registro.evidencia_url = None

    # ---------------------------------------------------------
    # CONSUMO APROXIMADO DEL INSUMO QUÍMICO
    # ---------------------------------------------------------
    # El consumo se guarda directamente en RegistroTarea.
    # Ya no se maneja stock ni una tabla separada de consumos.
    if completado:
        # Si se envían datos de consumo, deben venir completos
        if insumo_quimico_id is not None or cantidad_consumida is not None:
            if insumo_quimico_id is None or cantidad_consumida is None:
                raise CantidadConsumidaInvalida()
            insumo = db.get(InsumoQuimico, insumo_quimico_id)
            if insumo is None or not insumo.activo:
                raise exceptions.InsumoQuimicoNoEncontrado()
            registro.insumo_quimico_id = insumo_quimico_id
            registro.cantidad_consumida = cantidad_consumida
        # Si no se envían datos de consumo y el registro ya tenía valores,
        # se mantienen (no se borran al completar sin enviar consumo).
        # Si no había valores, quedan como están (None).
    else:
        # Al desmarcar, se limpia el consumo asociado
        registro.insumo_quimico_id = None
        registro.cantidad_consumida = None
    # Registro del elemento de limpieza utilizado

    if completado and elemento_limpieza_id is not None:
        registro.elemento_limpieza_id = elemento_limpieza_id
    elif not completado:
        registro.elemento_limpieza_id = None

    consumo_nuevo = (
        registro.insumo_quimico_id,
        Decimal(str(registro.cantidad_consumida)) if registro.cantidad_consumida is not None else None,
    )

    # El descuento y su trazabilidad son parte de la misma unidad de trabajo
    # que el estado de la tarea. Un reintento idéntico no genera diferencia.
    try:
        sincronizar_consumo_checklist(
            db,
            registro_id=registro.id,
            checklist_id=checklist.id,
            checklist_fecha=checklist.fecha,
            tarea_nombre=registro.nombre_tarea_historico,
            consumo_anterior=consumo_anterior,
            consumo_nuevo=consumo_nuevo,
            usuario_id=usuario_id,
            usuario_nombre=usuario_nombre,
        )
    except Exception:
        db.rollback()
        raise
    # ---------------------------------------------------------
    # AUDITORÍA
    # ---------------------------------------------------------
    # Se agrega un evento nuevo y nunca se pisa el historial.
    db.add(
        models.HistorialRegistroTarea(
            registro_tarea_id=registro.id,
            completado=completado,
            usuario_id=usuario_id,
            evidencia_url=evidencia_url,
        )
    )

    # ---------------------------------------------------------
    # ACTUALIZAMOS EL ESTADO GENERAL DEL CHECKLIST
    # ---------------------------------------------------------
    total = len(checklist.registros)

    completadas = sum(
        1
        for r in checklist.registros
        if (
            (r.id != registro.id and r.completado)
            or
            (r.id == registro.id and completado)
        )
    )

    checklist.estado = (
        models.EstadoChecklist.COMPLETO
        if total > 0 and completadas == total
        else models.EstadoChecklist.ABIERTO
    )

    # Un único commit guarda:
    # - estado de la tarea
    # - historial
    # - producto químico utilizado y cantidad aproximada consumida
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(registro)

    return registro


def obtener_historial_registro(db: Session, registro_id: int) -> schemas.HistorialRegistroTareaResponse:
    registro = db.get(models.RegistroTarea, registro_id)
    if registro is None:
        raise exceptions.RegistroTareaNoEncontrado()

    eventos = db.scalars(
        select(models.HistorialRegistroTarea)
        .where(models.HistorialRegistroTarea.registro_tarea_id == registro_id)
        .options(selectinload(models.HistorialRegistroTarea.usuario))
        .order_by(models.HistorialRegistroTarea.fecha_evento)
    ).all()

    items = []
    for e in eventos:
        item = schemas.HistorialRegistroTareaItem.model_validate(e)
        if e.usuario is not None:
            item.usuario_nombre = f"{e.usuario.nombre} {e.usuario.apellido or ''}".strip()
        items.append(item)

    return schemas.HistorialRegistroTareaResponse(
        registro_id=registro_id,
        eventos=items,
    )


def asignar_cobertura_tarea(
    db: Session,
    registro_id: int,
    operador_id: Optional[int],
    reemplazado_por_id: int,
) -> models.RegistroTarea:
    """Asigna (o reasigna) el operador responsable de una tarea de hoy.

    Solo aplica sobre checklists del día actual (no cerrados). El
    `reemplazado_por_id` registra al administrador que hizo el cambio, para
    conservar rastro de quién cubrió la ausencia del operador original.

    Si `operador_id` es None, se desasigna el operador (cualquier operador
    podrá tomar la tarea al marcarla).
    """
    registro = db.get(models.RegistroTarea, registro_id)
    if registro is None:
        raise RegistroTareaNoEncontrado()

    checklist = db.get(models.Checklist, registro.checklist_id)
    if checklist is None:
        raise ChecklistNoEncontrado()

    hoy_val = hoy()
    if checklist.fecha < hoy_val:
        raise ChecklistInmutable()

    # Validar que el nuevo operador exista, esté activo y pueda operar.
    if operador_id is not None:
        nuevo_operador = db.get(Personal, operador_id)
        if (
            nuevo_operador is None
            or not nuevo_operador.activo
            or not nuevo_operador.puede_operar
        ):
            raise BadRequest(
                "El operador indicado no existe, está dado de baja o no tiene permiso de operar."
            )

    # Si ya tiene operador asignado (responsable original), no lo cambiamos:
    # solo registramos quién lo cubre en reemplazado_por_id.
    if registro.operador_id is not None:
        registro.reemplazado_por_id = reemplazado_por_id
    else:
        # No tiene operador asignado: asignamos el nuevo operador.
        registro.operador_id = operador_id
        registro.reemplazado_por_id = reemplazado_por_id

    # Queda constancia en el historial de cobertura (sin cambiar el
    # completado de la tarea).
    db.add(
        models.HistorialRegistroTarea(
            registro_tarea_id=registro.id,
            completado=registro.completado,
            usuario_id=reemplazado_por_id,
            evidencia_url=None,
        )
    )

    db.commit()
    db.refresh(registro)
    return registro
