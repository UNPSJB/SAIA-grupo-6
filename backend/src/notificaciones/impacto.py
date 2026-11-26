"""Configuración de cada tipo de situación, por establecimiento.

SAIA sugiere una clasificación inicial (`riesgo.TIPOS_SITUACION`) y el
administrador decide, tipo por tipo: si genera riesgo, su impacto, si exige
plan de acción desde la primera detección y, en los incidentes de circuito
(reclamos, retiros y rechazos), qué causas cuentan. Solo se guardan los tipos
que cambiaron; el resto usa lo sugerido. El impacto de una situación es siempre
el de su tipo: no se ajusta situación por situación.
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.establecimientos.contexto import sede_efectiva
from src.exceptions import BadRequest, NotFound
from src.notificaciones import riesgo
from src.notificaciones.invalidacion import invalidar_notificaciones
from src.notificaciones.models import ConfiguracionImpacto
from src.notificaciones.schemas import (
    CausaSituacionResponse,
    ImpactoSituacionResponse,
    ImpactoSituacionUpdate,
)


def _causas_de_fila(fila: ConfiguracionImpacto, sugeridas: frozenset[str]) -> frozenset[str]:
    if fila.causas is None:
        return sugeridas
    try:
        valores = json.loads(fila.causas)
    except ValueError:
        return sugeridas
    return frozenset(str(v) for v in valores) if isinstance(valores, list) else sugeridas


def _desde_fila(tipo: str, fila: ConfiguracionImpacto | None) -> riesgo.ConfiguracionTipo:
    sugerida = riesgo.configuracion_sugerida(tipo)
    if fila is None:
        return sugerida
    return riesgo.ConfiguracionTipo(
        activo=sugerida.activo if fila.activo is None else bool(fila.activo),
        # Un valor inválido en la base no tumba el motor.
        impacto=fila.impacto if riesgo.impacto_valido(fila.impacto) else sugerida.impacto,
        plan_obligatorio=(
            sugerida.plan_obligatorio
            if fila.plan_obligatorio is None
            else bool(fila.plan_obligatorio)
        ),
        causas=_causas_de_fila(fila, sugerida.causas),
    )


def configuracion_vigente(db: Session) -> dict[str, riesgo.ConfiguracionTipo]:
    """Lo que usa el motor para cada tipo de situación en esta sede."""
    filas = {
        fila.tipo: fila
        for fila in db.scalars(
            select(ConfiguracionImpacto).where(
                ConfiguracionImpacto.establecimiento_id == sede_efectiva(db)
            )
        )
    }
    return {tipo: _desde_fila(tipo, filas.get(tipo)) for tipo in riesgo.TIPOS_SITUACION}


def impactos_vigentes(db: Session) -> dict[str, int]:
    """Impacto que usa el motor para cada tipo de situación."""
    return {tipo: config.impacto for tipo, config in configuracion_vigente(db).items()}


def _respuesta(tipo: str, config: riesgo.ConfiguracionTipo) -> ImpactoSituacionResponse:
    datos = riesgo.TIPOS_SITUACION[tipo]
    sugerida = riesgo.configuracion_sugerida(tipo)
    return ImpactoSituacionResponse(
        tipo=tipo,
        etiqueta=datos.etiqueta,
        impacto=config.impacto,
        impacto_sugerido=sugerida.impacto,
        activo=config.activo,
        activo_sugerido=sugerida.activo,
        plan_obligatorio=config.plan_obligatorio,
        plan_obligatorio_sugerido=sugerida.plan_obligatorio,
        causas=[
            CausaSituacionResponse(
                valor=valor,
                etiqueta=etiqueta,
                cuenta=valor in config.causas,
                sugerida=valor in sugerida.causas,
            )
            for valor, etiqueta in datos.causas
        ],
        modificado=config != sugerida,
    )


def _exigir_tipo(tipo: str) -> None:
    if tipo not in riesgo.TIPOS_SITUACION:
        raise NotFound(f"No existe el tipo de situación {tipo}.")


def listar_impactos(db: Session) -> list[ImpactoSituacionResponse]:
    vigentes = configuracion_vigente(db)
    return [_respuesta(tipo, vigentes[tipo]) for tipo in riesgo.TIPOS_SITUACION]


def fijar_impacto(
    db: Session, tipo: str, cambios: ImpactoSituacionUpdate | int
) -> ImpactoSituacionResponse:
    """Cambia lo que se indique (los campos ausentes quedan como estaban). Un
    entero es solo el impacto."""
    if isinstance(cambios, int):
        cambios = ImpactoSituacionUpdate(impacto=cambios)
    _exigir_tipo(tipo)
    datos = riesgo.TIPOS_SITUACION[tipo]
    actual = configuracion_vigente(db)[tipo]

    causas = actual.causas
    if cambios.causas is not None:
        if not datos.causas:
            raise BadRequest("Este tipo de situación no se filtra por causa.")
        validas = {valor for valor, _ in datos.causas}
        desconocidas = set(cambios.causas) - validas
        if desconocidas:
            raise BadRequest(f"Causa no válida: {', '.join(sorted(desconocidas))}.")
        causas = frozenset(cambios.causas)

    nueva = riesgo.ConfiguracionTipo(
        activo=actual.activo if cambios.activo is None else cambios.activo,
        impacto=actual.impacto if cambios.impacto is None else cambios.impacto,
        plan_obligatorio=(
            actual.plan_obligatorio
            if cambios.plan_obligatorio is None
            else cambios.plan_obligatorio
        ),
        causas=causas,
    )

    clave = {"establecimiento_id": sede_efectiva(db), "tipo": tipo}
    fila = db.get(ConfiguracionImpacto, clave)
    if nueva == riesgo.configuracion_sugerida(tipo):
        if fila is not None:
            db.delete(fila)
    else:
        if fila is None:
            fila = ConfiguracionImpacto(tipo=tipo, impacto=nueva.impacto)
            db.add(fila)
        fila.impacto = nueva.impacto
        fila.activo = nueva.activo
        fila.plan_obligatorio = nueva.plan_obligatorio
        fila.causas = json.dumps(sorted(nueva.causas)) if datos.causas else None
    db.commit()
    # Los puntajes persistidos dependen de esto: se recalculan en la próxima lectura.
    invalidar_notificaciones(db)
    return _respuesta(tipo, nueva)


def restaurar_impacto(db: Session, tipo: str) -> ImpactoSituacionResponse:
    """Vuelve a todo lo sugerido por SAIA para el tipo."""
    _exigir_tipo(tipo)
    fila = db.get(ConfiguracionImpacto, {"establecimiento_id": sede_efectiva(db), "tipo": tipo})
    if fila is not None:
        db.delete(fila)
        db.commit()
        invalidar_notificaciones(db)
    return _respuesta(tipo, riesgo.configuracion_sugerida(tipo))
