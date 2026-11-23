"""Impacto base de cada tipo de situación, configurable por establecimiento.

SAIA sugiere una clasificación inicial (`riesgo.TIPOS_SITUACION`) y el
administrador puede aceptarla o cambiarla. Solo se guardan los tipos que
cambiaron; el resto usa el valor sugerido. El impacto de una situación es
siempre el impacto de su tipo: no se ajusta situación por situación.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.establecimientos.contexto import sede_efectiva
from src.exceptions import NotFound
from src.notificaciones import riesgo
from src.notificaciones.invalidacion import invalidar_notificaciones
from src.notificaciones.models import ConfiguracionImpacto
from src.notificaciones.schemas import ImpactoSituacionResponse


def impactos_vigentes(db: Session) -> dict[str, int]:
    """Impacto que usa el motor para cada tipo de situación."""
    impactos = {
        tipo: datos.impacto_sugerido for tipo, datos in riesgo.TIPOS_SITUACION.items()
    }
    for fila in db.scalars(
        select(ConfiguracionImpacto).where(ConfiguracionImpacto.establecimiento_id == sede_efectiva(db))
    ):
        # Un tipo que ya no existe o un valor inválido en la base no tumban el motor.
        if fila.tipo in impactos and riesgo.impacto_valido(fila.impacto):
            impactos[fila.tipo] = fila.impacto
    return impactos


def _respuesta(tipo: str, impacto: int) -> ImpactoSituacionResponse:
    datos = riesgo.TIPOS_SITUACION[tipo]
    return ImpactoSituacionResponse(
        tipo=tipo,
        etiqueta=datos.etiqueta,
        impacto=impacto,
        impacto_sugerido=datos.impacto_sugerido,
        modificado=impacto != datos.impacto_sugerido,
    )


def _exigir_tipo(tipo: str) -> None:
    if tipo not in riesgo.TIPOS_SITUACION:
        raise NotFound(f"No existe el tipo de situación '{tipo}'.")


def listar_impactos(db: Session) -> list[ImpactoSituacionResponse]:
    vigentes = impactos_vigentes(db)
    return [_respuesta(tipo, vigentes[tipo]) for tipo in riesgo.TIPOS_SITUACION]


def fijar_impacto(db: Session, tipo: str, impacto: int) -> ImpactoSituacionResponse:
    _exigir_tipo(tipo)
    fila = db.get(ConfiguracionImpacto, {"establecimiento_id": sede_efectiva(db), "tipo": tipo})
    if fila is None:
        db.add(ConfiguracionImpacto(tipo=tipo, impacto=impacto))
    else:
        fila.impacto = impacto
    db.commit()
    # Los puntajes persistidos dependen del impacto: se recalculan en la
    # próxima lectura.
    invalidar_notificaciones(db)
    return _respuesta(tipo, impacto)


def restaurar_impacto(db: Session, tipo: str) -> ImpactoSituacionResponse:
    """Vuelve al impacto sugerido por SAIA."""
    _exigir_tipo(tipo)
    fila = db.get(ConfiguracionImpacto, {"establecimiento_id": sede_efectiva(db), "tipo": tipo})
    if fila is not None:
        db.delete(fila)
        db.commit()
        invalidar_notificaciones(db)
    return _respuesta(tipo, riesgo.TIPOS_SITUACION[tipo].impacto_sugerido)
