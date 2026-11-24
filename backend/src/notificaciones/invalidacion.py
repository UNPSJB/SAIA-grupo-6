"""src/notificaciones/invalidacion.py

Invalidación + recálculo perezoso de `notificaciones_persistidas`.

Idea: las mutaciones NO recalculan. Solo marcan la caché como "sucia" (un UPDATE
de una fila). El recálculo completo ocurre una sola vez, en la primera lectura
posterior, y también una vez por día (las alertas dependen de `hoy()`).

Piezas:
  1. EstadoNotificaciones  -> tabla de una fila (se crea sola con create_all al importar este módulo)
  2. invalidar_notificaciones()        -> reemplaza a recalcular_... en los 24 puntos
  3. asegurar_notificaciones_al_dia()  -> se llama al inicio de toda lectura
  4. registrar_invalidacion_automatica() -> (fase 2) invalida solo, sin tocar routers
"""
from __future__ import annotations

from datetime import date
from itertools import chain

from sqlalchemy import Boolean, Date, Integer, delete, event, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from src.common.fechas import hoy
from src.establecimientos.contexto import sede_efectiva
from src.establecimientos.models import (
    DatosDeEstablecimiento,
    _ConEstablecimiento,
    columna_sede_pk,
)
from src.models import ModeloBase
from src.notificaciones.models import NotificacionPersistida


# ──────────────────────────────────────────────────────────────────────────
# 1) Modelo
# ──────────────────────────────────────────────────────────────────────────
class EstadoNotificaciones(DatosDeEstablecimiento, ModeloBase):
    """Una fila por sede: ¿su tabla persistida está al día?

    Tiene que ser por sede: cada una calcula sus propias notificaciones, y si
    el recálculo de una marcara "al día" a todas, las demás nunca recalcularían.
    """

    __tablename__ = "estado_notificaciones"
    __audit__ = False

    establecimiento_id: Mapped[int] = columna_sede_pk()
    sucio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Día para el que se calculó la tabla (los VENCIDO/PRÓXIMO dependen de hoy()).
    fecha_calculo: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Sube solo cuando el contenido cambió de verdad: sirve de ETag para el front.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


def _condicion_estado(db: Session, *extra):
    """La fila de la sede de esta sesión (explícito: también sin contexto)."""
    return (EstadoNotificaciones.establecimiento_id == sede_efectiva(db), *extra)


# ──────────────────────────────────────────────────────────────────────────
# 2) Invalidar: barato, sin calcular nada
# ──────────────────────────────────────────────────────────────────────────
def invalidar_notificaciones(db: Session) -> None:
    db.execute(
        update(EstadoNotificaciones)
        .where(*_condicion_estado(db))
        .values(sucio=True)
    )
    db.commit()


# ──────────────────────────────────────────────────────────────────────────
# 3) Asegurar que la tabla esté al día (llamar al inicio de cada lectura)
# ──────────────────────────────────────────────────────────────────────────
def asegurar_notificaciones_al_dia(db: Session) -> None:
    hoy_dia = hoy()

    fila = db.execute(
        select(EstadoNotificaciones.sucio, EstadoNotificaciones.fecha_calculo)
        .where(*_condicion_estado(db))
    ).one_or_none()

    if fila is None:
        # Primer arranque. Lo ideal es crear la fila en crear_tablas_y_migrar().
        db.add(EstadoNotificaciones(establecimiento_id=sede_efectiva(db), sucio=True, version=0))
        try:
            db.commit()
        except IntegrityError:  # otro request la creó antes
            db.rollback()
    elif not fila.sucio and fila.fecha_calculo == hoy_dia:
        return  # camino caliente: una sola lectura de una fila

    # Reclamar el trabajo con un UPDATE condicional. Reclamo + recálculo van en
    # la MISMA transacción: si el recálculo falla, el rollback deshace el reclamo
    # y la tabla queda marcada como sucia; si dos requests compiten, el segundo
    # espera el lock y después ve rowcount == 0 (ya está hecho).
    reclamado = db.execute(
        update(EstadoNotificaciones)
        .where(
            *_condicion_estado(
                db,
                or_(
                    EstadoNotificaciones.sucio.is_(True),
                    EstadoNotificaciones.fecha_calculo.is_(None),
                    EstadoNotificaciones.fecha_calculo != hoy_dia,
                )
            )
        )
        .values(sucio=False, fecha_calculo=hoy_dia)
    ).rowcount

    if not reclamado:
        return  # otro request ya lo recalculó; no hay nada que deshacer

    try:
        _sincronizar_tabla(db)
        db.commit()
    except Exception:
        db.rollback()
        raise


def _sincronizar_tabla(db: Session) -> None:
    """Calcula el estado correcto y lo aplica como DIFF (sin DELETE total)."""
    from src.notificaciones import services  # import tardío: evita el ciclo

    nuevas = {f["id_notificacion"]: f for f in services.calcular_filas_notificaciones(db)}
    existentes = {f.id_notificacion: f for f in db.scalars(select(NotificacionPersistida))}

    hubo_cambios = False
    for clave, datos in nuevas.items():
        fila = existentes.pop(clave, None)
        if fila is None:
            db.add(NotificacionPersistida(**datos))
            hubo_cambios = True
            continue
        for campo, valor in datos.items():
            if getattr(fila, campo) != valor:
                setattr(fila, campo, valor)
                hubo_cambios = True

    for sobrante in existentes.values():  # ya no corresponden
        db.delete(sobrante)
        hubo_cambios = True

    if existentes:
        from src.notificaciones.models import NotificacionLeida
        claves_eliminadas = list(existentes.keys())
        db.execute(
            delete(NotificacionLeida)
            .where(
                NotificacionLeida.establecimiento_id == sede_efectiva(db),
                NotificacionLeida.id_notificacion.in_(claves_eliminadas),
            )
        )

    if hubo_cambios:
        db.execute(
            update(EstadoNotificaciones)
            .where(*_condicion_estado(db))
            .values(version=EstadoNotificaciones.version + 1)
        )


# ──────────────────────────────────────────────────────────────────────────
# 4) Fase 2: invalidación automática (reemplaza los 24 llamados manuales)
# ──────────────────────────────────────────────────────────────────────────
_MARCA = "notificaciones_sucias"
_TODAS = "todas"
_instalado = False


def registrar_invalidacion_automatica() -> None:
    """Llamar UNA vez al arrancar (p. ej. en el lifespan, después de all_models)."""
    from src.aptitud.models import Aptitud
    from src.checklist.models import Checklist
    from src.documentos.models import Documento, VersionDocumento
    from src.Equipo.models import Equipo
    from src.elementoLimpieza.models import ElementoLimpieza
    from src.incidente.models import Incidente
    from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico
    from src.notificaciones.models import ConfiguracionAlerta, ConfiguracionImpacto
    from src.personal.models import Personal
    from src.lotesInsumo.models import LoteInsumo
    from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
    from src.vencimientoPersonal.models import VencimientoPersonal

    from src.unidadMedida.models import UnidadMedida

    registro_checklist = Checklist.registros.property.mapper.class_

    fuentes = (
        UnidadMedida,
        ElementoLimpieza, PlanCalibracionMantenimiento, Equipo, VencimientoPersonal,
        Personal, Aptitud, InsumoQuimico, StockInsumoQuimico, Documento,
        VersionDocumento, Incidente, Checklist, registro_checklist, ConfiguracionAlerta,
        ConfiguracionImpacto, LoteInsumo,
    )

    global _instalado
    if _instalado:  # idempotente: evita listeners duplicados si se llama dos veces
        return
    _instalado = True
    # Sobre la clase Session (no sobre un sessionmaker): cubre cualquier sesión,
    # también las de scripts y tests que no usan SessionLocal.
    _instalar_listeners(Session, fuentes)


def _instalar_listeners(origen, fuentes: tuple[type, ...]) -> None:
    """Engancha la invalidación a `origen` (un sessionmaker o la clase Session).

    Se hace en `after_flush` y NO en `before_commit`: en un commit, `before_commit`
    corre antes del flush final, así que todavía no se vería lo que se va a
    escribir. El UPDATE sale por la conexión de la sesión, o sea dentro de la
    MISMA transacción que la mutación: si ésta se deshace, la marca también.
    """

    @event.listens_for(origen, "after_flush")
    def _detectar(session: Session, _ctx) -> None:
        marcadas: set = session.info.setdefault(_MARCA, set())
        if _TODAS in marcadas:
            return
        # En after_flush, new/dirty/deleted todavía reflejan lo que se acaba de escribir.
        # Se ensucia solo la sede del cambio; un cambio global (una unidad de
        # medida, un super admin sin sede) ensucia a todas.
        sedes: set = set()
        for obj in chain(session.new, session.dirty, session.deleted):
            if not isinstance(obj, fuentes):
                continue
            sede = getattr(obj, "establecimiento_id", None)
            if isinstance(obj, _ConEstablecimiento) and sede is not None:
                sedes.add(sede)
            else:
                sedes = {_TODAS}
                break
        sedes -= marcadas
        if not sedes:
            return
        tabla = EstadoNotificaciones.__table__
        sentencia = update(tabla).values(sucio=True)
        if _TODAS not in sedes:
            sentencia = sentencia.where(tabla.c.establecimiento_id.in_(sedes))
        session.connection().execute(sentencia)
        marcadas |= sedes

    @event.listens_for(origen, "after_commit")
    @event.listens_for(origen, "after_rollback")
    def _limpiar(session: Session) -> None:
        session.info.pop(_MARCA, None)
