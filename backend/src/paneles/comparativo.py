"""Tablero comparativo entre establecimientos (gerentes y super admin).

Es la única pantalla que mira varias sedes a la vez. En vez de duplicar cada
cálculo con un `GROUP BY establecimiento_id`, recorre las sedes activas y,
para cada una, fija la sede en la sesión y reusa los mismos cálculos que ya
usan la vista pública y los paneles: el filtro automático
(`src.establecimientos.contexto`) hace que cada número salga solo de esa sede.
Al terminar se restaura la sede original de la sesión.

Hay dos tipos de indicador:

* porcentajes de cumplimiento (limpieza, equipos, aptitudes, documentos,
  elementos), donde más alto es mejor;
* conteos del período (lotes, incidentes, reclamos, retiros). Para los de
  problemas, más bajo es mejor.
"""

from dataclasses import dataclass
from typing import Callable, Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.aptitud.models import Aptitud
from src.checklist.services import conteo_cumplimiento_periodo
from src.common.fechas import hoy
from src.establecimientos.contexto import establecimiento_activo, fijar_establecimiento
from src.establecimientos.models import Establecimiento
from src.incidente.models import Incidente
from src.lotes.constants import ESTADO_TERMINADO
from src.lotes.models import LoteProducto
from src.paneles import schemas
from src.paneles.services import _en_periodo
from src.personal.models import Personal
from src.reclamos.models import Reclamo
from src.retiros.models import Retiro
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vistaPublica.services import (
    _documentos_vigentes,
    _elementos_al_dia,
    _equipos_al_dia,
    _porcentaje,
)

Formato = Literal["porcentaje", "cantidad"]
Mejor = Literal["alto", "bajo"]


@dataclass(frozen=True)
class Indicador:
    clave: str
    etiqueta: str
    descripcion: str
    formato: Formato
    mejor: Mejor
    calcular: Callable[[Session, schemas.Periodo], Optional[float]]


# ───────────────────────── Cálculos por sede ─────────────────────────


def _cumplimiento_limpieza(db: Session, periodo: schemas.Periodo) -> Optional[float]:
    total, completadas = conteo_cumplimiento_periodo(db, periodo.desde, periodo.hasta, None)
    return _porcentaje(completadas, total)


def _personal_apto(db: Session, _periodo: schemas.Periodo) -> Optional[float]:
    """Vencimientos de aptitud al día del personal activo.

    A diferencia de la vista pública no exige un universo mínimo: el tablero
    es interno y el porcentaje no identifica a nadie fuera de la empresa.
    """
    fechas = db.scalars(
        select(VencimientoPersonal.fecha_vencimiento)
        .join(Personal, Personal.id == VencimientoPersonal.persona_id)
        .join(Aptitud, Aptitud.id == VencimientoPersonal.aptitud_id)
        .where(
            VencimientoPersonal.activo.is_(True),
            Personal.activo.is_(True),
            Aptitud.activo.is_(True),
        )
    ).all()
    hoy_dia = hoy()
    return _porcentaje(sum(1 for fecha in fechas if fecha >= hoy_dia), len(fechas))


def _sin_periodo(calculo: Callable[[Session], Optional[float]]):
    """Adapta un cálculo de "hoy" (vista pública) a la firma con período."""
    return lambda db, _periodo: calculo(db)


def _contar(modelo, columna, con_hora: bool, *extra):
    def calcular(db: Session, periodo: schemas.Periodo) -> float:
        return float(
            db.scalar(
                select(func.count())
                .select_from(modelo)
                .where(*_en_periodo(columna, periodo, con_hora), *extra)
            )
            or 0
        )

    return calcular


INDICADORES: tuple[Indicador, ...] = (
    Indicador(
        "cumplimiento_limpieza", "Cumplimiento de limpieza",
        "Tareas del checklist completadas en el período.",
        "porcentaje", "alto", _cumplimiento_limpieza,
    ),
    Indicador(
        "equipos_al_dia", "Equipos al día",
        "Equipos activos con calibración y mantenimiento vigentes (hoy).",
        "porcentaje", "alto", _sin_periodo(_equipos_al_dia),
    ),
    Indicador(
        "personal_apto", "Personal con aptitudes vigentes",
        "Vencimientos de aptitud del personal activo que están al día (hoy).",
        "porcentaje", "alto", _personal_apto,
    ),
    Indicador(
        "documentos_vigentes", "Documentación al día",
        "Documentos con versión vigente y sin vencer (hoy).",
        "porcentaje", "alto", _sin_periodo(_documentos_vigentes),
    ),
    Indicador(
        "elementos_al_dia", "Elementos de limpieza al día",
        "Elementos con recambio configurado dentro del plazo (hoy).",
        "porcentaje", "alto", _sin_periodo(_elementos_al_dia),
    ),
    Indicador(
        "lotes_iniciados", "Lotes iniciados",
        "Lotes de producción iniciados en el período.",
        "cantidad", "alto", _contar(LoteProducto, LoteProducto.fecha_inicio, True),
    ),
    Indicador(
        "lotes_terminados", "Lotes terminados",
        "Lotes de producción cerrados como terminados en el período.",
        "cantidad", "alto",
        _contar(LoteProducto, LoteProducto.fecha_cierre, True, LoteProducto.estado == ESTADO_TERMINADO),
    ),
    Indicador(
        "incidentes", "Incidentes reportados",
        "Incidentes reportados en el período.",
        "cantidad", "bajo", _contar(Incidente, Incidente.fecha_reporte, True),
    ),
    Indicador(
        "reclamos", "Reclamos de clientes",
        "Reclamos recibidos en el período.",
        "cantidad", "bajo", _contar(Reclamo, Reclamo.fecha_reclamo, False),
    ),
    Indicador(
        "retiros", "Retiros de lotes",
        "Retiros del mercado iniciados en el período.",
        "cantidad", "bajo", _contar(Retiro, Retiro.fecha_retiro, False),
    ),
)


# ───────────────────────── Armado del tablero ─────────────────────────


def _promedio(valores: list[Optional[float]]) -> Optional[float]:
    con_dato = [v for v in valores if v is not None]
    if not con_dato:
        return None
    return round(sum(con_dato) / len(con_dato), 1)


def _posicion(valor: Optional[float], valores: list[Optional[float]], mejor: Mejor) -> Optional[int]:
    """Puesto de `valor` entre las sedes con dato (1 = la mejor)."""
    if valor is None:
        return None
    con_dato = [v for v in valores if v is not None]
    if mejor == "alto":
        return 1 + sum(1 for v in con_dato if v > valor)
    return 1 + sum(1 for v in con_dato if v < valor)


def tablero_comparativo(
    db: Session, periodo: schemas.Periodo, sede_propia: int
) -> schemas.TableroComparativo:
    sedes = list(
        db.scalars(
            select(Establecimiento)
            .where(Establecimiento.activo.is_(True))
            .order_by(Establecimiento.nombre)
        )
    )

    valores: dict[str, list[Optional[float]]] = {i.clave: [] for i in INDICADORES}
    original = establecimiento_activo(db)
    try:
        for sede in sedes:
            fijar_establecimiento(db, sede.id)
            for indicador in INDICADORES:
                valores[indicador.clave].append(indicador.calcular(db, periodo))
    finally:
        fijar_establecimiento(db, original)

    indice_propio = next((i for i, s in enumerate(sedes) if s.id == sede_propia), None)

    indicadores = []
    for indicador in INDICADORES:
        serie = valores[indicador.clave]
        propio = serie[indice_propio] if indice_propio is not None else None
        indicadores.append(
            schemas.IndicadorComparativo(
                clave=indicador.clave,
                etiqueta=indicador.etiqueta,
                descripcion=indicador.descripcion,
                formato=indicador.formato,
                mejor=indicador.mejor,
                valores=[
                    schemas.ValorSede(establecimiento_id=sede.id, valor=valor)
                    for sede, valor in zip(sedes, serie)
                ],
                promedio_empresa=_promedio(serie),
                valor_propio=propio,
                posicion_propia=_posicion(propio, serie, indicador.mejor),
            )
        )

    return schemas.TableroComparativo(
        periodo=periodo,
        establecimiento_propio_id=sede_propia,
        establecimientos=[schemas.SedeComparada(id=s.id, nombre=s.nombre) for s in sedes],
        indicadores=indicadores,
    )
