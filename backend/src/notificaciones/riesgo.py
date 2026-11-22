"""Cálculo del riesgo: modelo semicuantitativo Impacto × Probabilidad.

Módulo PURO: no toca la base de datos ni importa SQLAlchemy. Todo lo que es
fórmula o parámetro vive acá, para poder probarlo sin infraestructura y para
cambiarlo en un solo lugar.

Resumen de la propuesta que implementa:

    Probabilidad       = 0,7 × Recurrencia + 0,3 × Persistencia      (cada una de 1 a 3)
    Riesgo individual  = Impacto × Probabilidad                       (1 a 9, un decimal)
    Riesgo consolidado = mín(9 ; riesgo más alto + 0,3 × mín(riesgo más alto ; suma de los restantes))
                         (0 si el elemento no tiene situaciones presentes)

    Nivel: bajo de 1 a 3 · medio hasta 6 · alto hasta 9 · sin riesgo si es 0.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, Sequence

# ============================================================
# PARÁMETROS (sección 10 de la propuesta: "a definir antes de implementar")
# ============================================================
# Son valores INICIALES. Cambiarlos acá alcanza: nada más los repite.

#: Ventana de recurrencia: período, en días, en el que se cuentan las
#: detecciones del mismo tipo sobre el mismo elemento.
DIAS_VENTANA_RECURRENCIA = 30

#: Umbrales de recurrencia: desde cuántas detecciones (dentro de la ventana,
#: incluida la actual) corresponde el puntaje 2 y el 3. Menos que el primero
#: es 1.   1 o 2 detecciones → 1 · 3 a 5 → 2 · 6 o más → 3
UMBRALES_RECURRENCIA: tuple[int, int] = (3, 6)

#: Umbrales de persistencia, en días presente: hasta el primero es 1, hasta el
#: segundo es 2 y más es 3.   0–2 días → 1 · 3–7 → 2 · más de 7 → 3
UMBRALES_PERSISTENCIA_DEFECTO: tuple[int, int] = (2, 7)

#: Los umbrales de persistencia pueden variar según el tipo de situación.
#: Clave: tipo de situación (ver `TIPOS_SITUACION`). Lo que no figura usa el
#: valor por defecto.
UMBRALES_PERSISTENCIA_POR_TIPO: dict[str, tuple[int, int]] = {}

#: Pesos de la probabilidad.
PESO_RECURRENCIA = 0.7
PESO_PERSISTENCIA = 0.3

#: Peso con el que suman las situaciones restantes en el riesgo consolidado, y
#: tope de lo que pueden sumar entre todas, como fracción de la peor.
PESO_RESTANTES = 0.3

#: Límites de los niveles (inclusivos por arriba).
LIMITE_BAJO = 3.0
LIMITE_MEDIO = 6.0
RIESGO_MAXIMO = 9.0

Nivel = Literal["sin_riesgo", "bajo", "medio", "alto"]
Criticidad = Literal["alta", "media", "baja"]


# ============================================================
# QUÉ GENERA RIESGO E IMPACTO BASE
# ============================================================
#
# Generan riesgo:
#
#   - los incidentes de higiene y contaminación, falla de equipos y plagas, y
#     los de tipo "Otro" (la categoría "Otros");
#   - quedarse sin stock (insumo por debajo del mínimo);
#   - el incumplimiento de los checklists;
#   - los vencimientos (documentos, aptitudes del personal, calibraciones,
#     mantenimientos y recambios de limpieza), vencidos o próximos a vencer.
#
# Los incidentes de otras clases (devolución de cliente) se notifican, pero no
# entran en el cálculo.
#
# Los reclamos de clientes, los retiros de lote y los rechazos de entrega no
# generan riesgo por sí mismos: de ellos solo interesa la CAUSA, y la única
# causa relevante es higiene o contaminación. Un reclamo, retiro o rechazo
# cuya causa lo sea cuenta como un evento de "Higiene y contaminación"; con
# cualquier otra causa se notifica sin riesgo.
#
# El impacto de cada tipo de evento lo puede cambiar el administrador, también
# el de "Otros".

@dataclass(frozen=True)
class TipoSituacion:
    etiqueta: str
    #: Impacto base sugerido por SAIA: 1 bajo · 2 medio · 3 alto. El
    #: administrador del establecimiento puede cambiarlo.
    impacto_sugerido: int


#: Tipos de evento que generan riesgo. La clasificación sugerida es la que el
#: motor anterior ya usaba: incidentes = 3 (alta); stock, vencido = 2 (media);
#: checklist, próximo a vencer = 1 (baja).
TIPOS_SITUACION: dict[str, TipoSituacion] = {
    "HIGIENE_CONTAMINACION": TipoSituacion("Higiene y contaminación", 3),
    "FALLA_EQUIPO": TipoSituacion("Falla de equipo", 3),
    "PLAGAS": TipoSituacion("Plagas", 3),
    "STOCK_BAJO": TipoSituacion("Stock por debajo del mínimo", 2),
    "CHECKLIST_INCOMPLETO": TipoSituacion("Checklist incumplido", 1),
    "OTROS": TipoSituacion("Otros", 3),
    "DOCUMENTO_VENCIDO": TipoSituacion("Documento vencido", 2),
    "DOCUMENTO_PROXIMO": TipoSituacion("Documento próximo a vencer", 1),
    "VENCIMIENTO_PERSONAL_VENCIDO": TipoSituacion("Aptitud vencida", 2),
    "VENCIMIENTO_PERSONAL_PROXIMO": TipoSituacion("Aptitud próxima a vencer", 1),
    "PLAN_CALIBRACION_VENCIDO": TipoSituacion("Calibración vencida", 2),
    "PLAN_CALIBRACION_PROXIMO": TipoSituacion("Calibración próxima a vencer", 1),
    "PLAN_MANTENIMIENTO_VENCIDO": TipoSituacion("Mantenimiento vencido", 2),
    "PLAN_MANTENIMIENTO_PROXIMO": TipoSituacion("Mantenimiento próximo a vencer", 1),
    "ELEMENTO_LIMPIEZA_VENCIDO": TipoSituacion("Recambio vencido", 2),
    "ELEMENTO_LIMPIEZA_PROXIMO": TipoSituacion("Recambio próximo a vencer", 1),
}

#: Tipo de incidente → tipo de evento de riesgo. Los valores son los de
#: `src.incidente.constants.TipoIncidente`.
TIPO_SITUACION_POR_INCIDENTE: dict[str, str] = {
    "higiene_contaminacion": "HIGIENE_CONTAMINACION",
    "falla_equipo": "FALLA_EQUIPO",
    "plagas": "PLAGAS",
    "otro": "OTROS",
}

#: Tipos de evento que nacen de un incidente (el resto, de stock, checklists y
#: vencimientos).
TIPOS_DE_INCIDENTE: frozenset[str] = frozenset(TIPO_SITUACION_POR_INCIDENTE.values())

#: Incidentes de sistema que solo generan riesgo según su causa, y qué causas
#: cuentan como higiene o contaminación. Para cada uno: la lista de motivos de
#: su circuito de origen (`src.reclamos.constants`, `src.retiros.constants`,
#: `src.salidas.constants`).
#:
#: - Reclamo de cliente: "Cuerpo extraño".
#: - Retiro de lote: "Contaminación o cuerpo extraño".
#: - Rechazo de entrega: ninguno de sus motivos es higiene o contaminación.
CAUSAS_DE_CONTAMINACION: dict[str, frozenset[str]] = {
    "reclamo_cliente": frozenset({"cuerpo_extrano"}),
    "retiro_lote": frozenset({"Contaminación o cuerpo extraño"}),
    "entrega_rechazada": frozenset(),
}

#: Etiquetas de lo que se notifica sin generar riesgo (la de los tipos de
#: riesgo está en `TIPOS_SITUACION`): los incidentes que no son de ninguna clase
#: de riesgo (reclamos, retiros y rechazos con otra causa, devoluciones).
ETIQUETAS_SIN_RIESGO: dict[str, str] = {
    "INCIDENTE_ABIERTO": "Incidente abierto",
}


def etiqueta_de(regla: str) -> str:
    """Texto de una regla, genere o no riesgo."""
    if regla in TIPOS_SITUACION:
        return TIPOS_SITUACION[regla].etiqueta
    return ETIQUETAS_SIN_RIESGO[regla]


def tipo_situacion_de_incidente(tipo_incidente: str, causa: str | None = None) -> str | None:
    """Tipo de evento de riesgo de un incidente, o `None` si no genera riesgo.

    `causa` es el motivo del circuito de origen (reclamo, retiro o rechazo);
    solo se mira en los incidentes de sistema.
    """
    directo = TIPO_SITUACION_POR_INCIDENTE.get(tipo_incidente)
    if directo is not None:
        return directo
    if causa is not None and causa in CAUSAS_DE_CONTAMINACION.get(tipo_incidente, frozenset()):
        return "HIGIENE_CONTAMINACION"
    return None


IMPACTO_MINIMO = 1
IMPACTO_MAXIMO = 3

ETIQUETA_IMPACTO = {1: "bajo", 2: "medio", 3: "alto"}


def impacto_valido(impacto: int) -> bool:
    return IMPACTO_MINIMO <= impacto <= IMPACTO_MAXIMO


# ============================================================
# REDONDEO
# ============================================================

def redondear(valor: float) -> float:
    """Un decimal, mitades hacia arriba (no el redondeo "a par" de `round`)."""
    return float(Decimal(str(round(valor, 6))).quantize(Decimal("0.1"), ROUND_HALF_UP))


# ============================================================
# PROBABILIDAD
# ============================================================

def puntaje_recurrencia(detecciones: int) -> int:
    """1 a 3 según cuántas veces se detectó el mismo tipo en el mismo elemento
    dentro de la ventana, incluida la actual."""
    segundo, tercero = UMBRALES_RECURRENCIA
    if detecciones >= tercero:
        return 3
    if detecciones >= segundo:
        return 2
    return 1


def puntaje_persistencia(dias_presente: int, tipo: str | None = None) -> int:
    """1 a 3 según cuántos días lleva presente la situación sin resolverse."""
    hasta_1, hasta_2 = UMBRALES_PERSISTENCIA_POR_TIPO.get(
        tipo or "", UMBRALES_PERSISTENCIA_DEFECTO
    )
    if dias_presente <= hasta_1:
        return 1
    if dias_presente <= hasta_2:
        return 2
    return 3


def probabilidad(recurrencia: int, persistencia: int) -> float:
    return PESO_RECURRENCIA * recurrencia + PESO_PERSISTENCIA * persistencia


# ============================================================
# RIESGO INDIVIDUAL
# ============================================================

@dataclass(frozen=True)
class Evaluacion:
    """Evaluación de una situación presente."""

    impacto: int
    recurrencia: int
    persistencia: int
    probabilidad: float
    riesgo: float
    nivel: Nivel


def evaluar_situacion(
    *,
    impacto: int,
    detecciones: int,
    dias_presente: int,
    tipo: str | None = None,
) -> Evaluacion:
    """Riesgo individual = Impacto × Probabilidad (1 a 9, un decimal).

    `detecciones` cuenta la situación actual: nunca es menor que 1.
    """
    if not impacto_valido(impacto):
        raise ValueError(f"Impacto fuera de rango: {impacto}")

    recurrencia = puntaje_recurrencia(max(detecciones, 1))
    persistencia = puntaje_persistencia(max(dias_presente, 0), tipo)
    prob = probabilidad(recurrencia, persistencia)
    riesgo = redondear(impacto * prob)

    return Evaluacion(
        impacto=impacto,
        recurrencia=recurrencia,
        persistencia=persistencia,
        probabilidad=redondear(prob),
        riesgo=riesgo,
        nivel=nivel_de(riesgo),
    )


# ============================================================
# RIESGO CONSOLIDADO DEL ELEMENTO
# ============================================================

def riesgo_consolidado(riesgos: Sequence[float]) -> float:
    """Riesgo general de un elemento a partir de sus situaciones presentes.

        mín(9 ; peor + 0,3 × mín(peor ; suma de las restantes))

    - Sin situaciones presentes: 0 (sin riesgo).
    - Una sola situación: es su riesgo individual.
    - Reconoce la acumulación: cada situación que se suma aporta el 30 % de su
      riesgo a lo que se agrega sobre la peor.
    - No la exagera: lo agregado nunca pasa del 30 % de la peor, así que el
      elemento no puede superar en más de un 30 % a su situación más grave
      (peor 3 → como mucho 3,9, tenga las situaciones que tenga).

    Sumar una situación NUNCA baja el resultado. El riesgo de un elemento solo
    baja si una situación se resuelve, si sale de la ventana de recurrencia, si
    el administrador cambia el impacto de un tipo o, más adelante, si se aplica
    un plan de acción. (La fórmula original de la propuesta promediaba las
    restantes y por eso una situación leve podía bajar el riesgo.)
    """
    if not riesgos:
        return 0.0
    if len(riesgos) == 1:
        return redondear(riesgos[0])

    restantes = list(riesgos)
    peor = max(restantes)
    restantes.remove(peor)  # saca UNA ocurrencia del máximo

    adicional = PESO_RESTANTES * min(peor, sum(restantes))
    return redondear(min(RIESGO_MAXIMO, peor + adicional))


# ============================================================
# NIVEL
# ============================================================

def nivel_de(puntaje: float) -> Nivel:
    """Bajo: de 1 a 3 · Medio: mayor a 3 y hasta 6 · Alto: mayor a 6 y hasta 9.
    Un puntaje 0 es un elemento sin situaciones presentes."""
    if puntaje <= 0:
        return "sin_riesgo"
    if puntaje <= LIMITE_BAJO:
        return "bajo"
    if puntaje <= LIMITE_MEDIO:
        return "medio"
    return "alto"


def criticidad_de(nivel: Nivel) -> Criticidad:
    """Nombre histórico del nivel individual (alta/media/baja), que el resto
    de la aplicación sigue usando para filtrar y pintar."""
    return {"alto": "alta", "medio": "media"}.get(nivel, "baja")


# ============================================================
# DETECCIÓN INICIAL
# ============================================================

def fecha_deteccion_inicial(tipo: str, fecha_referencia: date | None, hoy: date) -> date:
    """Desde cuándo está presente un evento que el motor ve por primera vez.

    El motor solo se entera cuando se recalcula, así que usar "hoy" siempre
    subestimaría la persistencia de lo que ya venía de antes (por ejemplo, al
    desplegar esta versión o si nadie abrió la aplicación en días). Donde el
    origen lo dice se usa esa fecha:

    - incidente: el día en que se reportó;
    - algo vencido: el día siguiente a su vencimiento;
    - el resto (próximo a vencer, stock, checklist): hoy.

    Nunca es posterior a `hoy`.
    """
    if fecha_referencia is None:
        return hoy
    if tipo in TIPOS_DE_INCIDENTE:
        inicio = fecha_referencia
    elif tipo.endswith("_VENCIDO"):
        inicio = fecha_referencia + timedelta(days=1)
    else:
        return hoy
    return min(inicio, hoy)
