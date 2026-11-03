import secrets
from datetime import date, timedelta
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.aptitud.models import Aptitud
from src.checklist.models import Checklist, RegistroTarea
from src.checklist.services import conteo_cumplimiento_periodo
from src.common.fechas import hoy
from src.common.persistence import guardar
from src.config import settings
from src.documentos.models import VersionDocumento
from src.elementoLimpieza.models import ElementoLimpieza
from src.Equipo.models import Equipo
from src.exceptions import BadRequest, UnprocessableContent
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.vencimientoPersonal.models import VencimientoPersonal

from .constants import CATALOGO, CATALOGO_POR_CLAVE
from .models import ConfiguracionVistaPublica, IndicadorVistaPublica


ID_CONFIGURACION_UNICA = 1
RUTA_PUBLICA = "publico"

# La vista pública mira una ventana fija y reciente de limpieza. No expone el
# detalle diario (eso sigue siendo del tablero interno): solo el agregado.
DIAS_VENTANA_POES = 30

# Con pocas personas, un porcentaje de aptitudes permite deducir la situación
# de alguien en particular. Por debajo de este universo el indicador no se
# publica: la vista pública es anónima y no puede identificar al personal.
MINIMO_PERSONAS_PUBLICO = 5


# ───────────────────────── Configuración general ─────────────────────────


def obtener_configuracion(
    db: Session,
) -> Optional[ConfiguracionVistaPublica]:
    """Obtiene la configuración; la ausencia transitoria equivale a desactivada."""
    return db.get(ConfiguracionVistaPublica, ID_CONFIGURACION_UNICA)


def actualizar_configuracion(
    db: Session, habilitada: bool
) -> ConfiguracionVistaPublica:
    """Activa o desactiva el único enlace público de la instalación."""
    configuracion = obtener_configuracion(db)
    if configuracion is None:
        # La migración crea la fila. Este fallback cubre bases de prueba o una
        # instalación interrumpida sin permitir más de una configuración.
        configuracion = ConfiguracionVistaPublica(id=ID_CONFIGURACION_UNICA)
        db.add(configuracion)

    if habilitada:
        if not configuracion.habilitada or not configuracion.codigo_publico:
            configuracion.codigo_publico = secrets.token_urlsafe(32)
        configuracion.habilitada = True
    else:
        configuracion.habilitada = False
        # Los QR previos no pueden volver a ser válidos tras una reactivación.
        configuracion.codigo_publico = None

    return guardar(db, configuracion)


def construir_url_publica(codigo_publico: str) -> str:
    """Arma el enlace desde la URL canónica configurada para el frontend."""
    if not settings.PUBLIC_APP_URL:
        raise BadRequest(
            "Configurá PUBLIC_APP_URL antes de activar la vista pública."
        )
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/{RUTA_PUBLICA}/{codigo_publico}"


def codigo_publico_valido(db: Session, codigo_publico: str) -> bool:
    """Verifica el enlace vigente sin revelar el estado de la configuración."""
    configuracion = obtener_configuracion(db)
    return bool(
        configuracion
        and configuracion.habilitada
        and configuracion.codigo_publico
        and secrets.compare_digest(codigo_publico, configuracion.codigo_publico)
    )


# ───────────────────────── Configuración de indicadores ─────────────────────────


def _estado_guardado(db: Session) -> dict[str, bool]:
    filas = db.scalars(select(IndicadorVistaPublica)).all()
    return {fila.clave: fila.habilitado for fila in filas}


def _indicador_con_datos(db: Session, clave: str) -> bool:
    """Si el indicador tiene universo suficiente para publicarse.

    Reutiliza el mismo cálculo que la vista pública, así el aviso del panel y
    lo que ve el visitante nunca se contradicen.
    """
    calculador = _CALCULADORES.get(clave)
    return calculador is not None and calculador(db) is not None


def obtener_indicadores(db: Session, incluir_datos: bool = False) -> list[dict]:
    """Catálogo completo con el estado efectivo de cada indicador.

    La fila ausente usa el default del catálogo. Así no hace falta un seed y
    una instalación nueva ya tiene una selección razonable.

    `incluir_datos` agrega `con_datos` para el panel administrativo. La vista
    pública no lo necesita: directamente omite los indicadores sin datos.
    """
    guardados = _estado_guardado(db)
    indicadores = [
        {
            "clave": definicion.clave,
            "etiqueta": definicion.etiqueta,
            "descripcion": definicion.descripcion,
            "formato": definicion.formato,
            "disponible": definicion.disponible,
            "habilitado": guardados.get(
                definicion.clave, definicion.habilitado_por_defecto
            ),
        }
        for definicion in CATALOGO
    ]
    if incluir_datos:
        for indicador in indicadores:
            indicador["con_datos"] = _indicador_con_datos(db, indicador["clave"])
    return indicadores


def actualizar_indicadores(
    db: Session, cambios: Iterable[tuple[str, bool]]
) -> list[dict]:
    """Aplica los cambios indicados y devuelve el catálogo resultante.

    Solo se aceptan claves del catálogo y disponibles. Una clave desconocida es
    un error del cliente (422), no un cambio silencioso.
    """
    por_clave = dict(cambios)
    for clave in por_clave:
        definicion = CATALOGO_POR_CLAVE.get(clave)
        if definicion is None or not definicion.disponible:
            raise UnprocessableContent(
                f"El indicador '{clave}' no está disponible para la vista pública."
            )

    filas = {
        fila.clave: fila for fila in db.scalars(select(IndicadorVistaPublica)).all()
    }
    for clave, habilitado in por_clave.items():
        fila = filas.get(clave)
        if fila is None:
            fila = IndicadorVistaPublica(clave=clave, habilitado=habilitado)
            db.add(fila)
            filas[clave] = fila
        else:
            fila.habilitado = habilitado

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return obtener_indicadores(db, incluir_datos=True)


# ───────────────────────── Cálculo de indicadores ─────────────────────────


def _porcentaje(al_dia: int, total: int) -> Optional[float]:
    """Porcentaje redondeado; `None` cuando no hay universo que medir."""
    if total <= 0:
        return None
    return round(al_dia / total * 100, 1)


def _cumplimiento_poes(db: Session) -> Optional[float]:
    hasta = hoy()
    desde = hasta - timedelta(days=DIAS_VENTANA_POES - 1)
    total, completadas = conteo_cumplimiento_periodo(db, desde, hasta, None)
    return _porcentaje(completadas, total)


def _tendencia_poes(db: Session, valor_actual: float) -> Optional[float]:
    """Puntos que mejoró el cumplimiento frente a los 30 días anteriores.

    Devuelve `None` si no hay período anterior con datos, si no cambió o si
    empeoró: la vista pública solo muestra mejoras, y decidirlo acá evita que
    una baja viaje en la respuesta anónima.
    """
    hasta = hoy() - timedelta(days=DIAS_VENTANA_POES)
    desde = hasta - timedelta(days=DIAS_VENTANA_POES - 1)
    total, completadas = conteo_cumplimiento_periodo(db, desde, hasta, None)
    anterior = _porcentaje(completadas, total)
    if anterior is None:
        return None

    mejora = round(valor_actual - anterior, 1)
    return mejora if mejora > 0 else None


def _equipos_al_dia(db: Session) -> Optional[float]:
    """Porcentaje de equipos activos con todos sus planes vigentes.

    Fusiona calibración y mantenimiento: un equipo está al día si, para cada
    tipo de plan activo que tiene, su vencimiento más lejano no pasó. Si tiene
    más de un plan del mismo tipo, manda el de vencimiento más lejano (la
    intervención más reciente es la que cubre hoy). Un equipo sin planes
    activos no entra en el universo: no hay nada que medir.
    """
    planes = db.scalars(
        select(PlanCalibracionMantenimiento)
        .join(Equipo, Equipo.id == PlanCalibracionMantenimiento.equipo_id)
        .where(
            PlanCalibracionMantenimiento.activo.is_(True),
            Equipo.activo.is_(True),
        )
    ).all()

    vencimiento_por_equipo_y_tipo: dict[tuple[int, str], date] = {}
    for plan in planes:
        clave = (plan.equipo_id, plan.tipo)
        vencimiento = plan.proxima_fecha_vencimiento
        actual = vencimiento_por_equipo_y_tipo.get(clave)
        if actual is None or vencimiento > actual:
            vencimiento_por_equipo_y_tipo[clave] = vencimiento

    vencimientos_por_equipo: dict[int, list[date]] = {}
    for (equipo_id, _tipo), vencimiento in vencimiento_por_equipo_y_tipo.items():
        vencimientos_por_equipo.setdefault(equipo_id, []).append(vencimiento)

    hoy_dia = hoy()
    al_dia = sum(
        1
        for vencimientos in vencimientos_por_equipo.values()
        if all(vencimiento >= hoy_dia for vencimiento in vencimientos)
    )
    return _porcentaje(al_dia, len(vencimientos_por_equipo))


def _personal_apto(db: Session) -> Optional[float]:
    filas = db.execute(
        select(VencimientoPersonal.persona_id, VencimientoPersonal.fecha_vencimiento)
        .join(Personal, Personal.id == VencimientoPersonal.persona_id)
        .join(Aptitud, Aptitud.id == VencimientoPersonal.aptitud_id)
        .where(
            VencimientoPersonal.activo.is_(True),
            Personal.activo.is_(True),
            Aptitud.activo.is_(True),
        )
    ).all()

    # El universo que protege la privacidad es el de personas, no el de
    # vencimientos: una sola persona con muchas aptitudes igual es identificable.
    personas = {persona_id for persona_id, _ in filas}
    if len(personas) < MINIMO_PERSONAS_PUBLICO:
        return None

    hoy_dia = hoy()
    al_dia = sum(1 for _, fecha in filas if fecha >= hoy_dia)
    return _porcentaje(al_dia, len(filas))


def _documentos_vigentes(db: Session) -> Optional[float]:
    versiones = db.scalars(
        select(VersionDocumento).where(VersionDocumento.vigente.is_(True))
    ).all()

    hoy_dia = hoy()
    al_dia = sum(
        1
        for version in versiones
        if version.fecha_vencimiento is None or version.fecha_vencimiento >= hoy_dia
    )
    return _porcentaje(al_dia, len(versiones))


def _elementos_al_dia(db: Session) -> Optional[float]:
    elementos = db.scalars(
        select(ElementoLimpieza).where(
            ElementoLimpieza.activo.is_(True),
            ElementoLimpieza.frecuencia_recambio_dias.is_not(None),
            ElementoLimpieza.fecha_ultimo_recambio.is_not(None),
        )
    ).all()

    hoy_dia = hoy()
    al_dia = 0
    for elemento in elementos:
        # El filtro de SQL garantiza ambos valores; el cast solo satisface al
        # verificador de tipos.
        frecuencia = int(elemento.frecuencia_recambio_dias or 0)
        ultimo = elemento.fecha_ultimo_recambio
        if ultimo is not None and ultimo + timedelta(days=frecuencia) >= hoy_dia:
            al_dia += 1

    return _porcentaje(al_dia, len(elementos))


_CALCULADORES = {
    "cumplimiento_poes": _cumplimiento_poes,
    "equipos_al_dia": _equipos_al_dia,
    "personal_apto": _personal_apto,
    "documentos_vigentes": _documentos_vigentes,
    "elementos_al_dia": _elementos_al_dia,
}

# Indicadores que además informan cuánto mejoraron respecto del período
# anterior. Reciben el valor actual para no recalcularlo.
_TENDENCIAS = {
    "cumplimiento_poes": _tendencia_poes,
}


def indicadores_publicos(db: Session) -> list[dict]:
    """Indicadores habilitados, ya calculados, para la vista anónima.

    No incluye conteos internos: solo la etiqueta pública, la descripción, el
    porcentaje agregado y, cuando corresponde, la mejora respecto del período
    anterior. Un indicador sin datos suficientes se omite en lugar de
    publicarse como "Sin datos" o como un 0 % falso.
    """
    estado = {indicador["clave"]: indicador for indicador in obtener_indicadores(db)}
    resultado: list[dict] = []

    for definicion in CATALOGO:
        configuracion = estado[definicion.clave]
        if not definicion.disponible or not configuracion["habilitado"]:
            continue

        calculador = _CALCULADORES.get(definicion.clave)
        if calculador is None:
            continue

        valor = calculador(db)
        if valor is None:
            continue

        calcular_tendencia = _TENDENCIAS.get(definicion.clave)
        tendencia = calcular_tendencia(db, valor) if calcular_tendencia else None

        resultado.append(
            {
                "clave": definicion.clave,
                "etiqueta": definicion.etiqueta,
                "descripcion": definicion.descripcion,
                "formato": definicion.formato,
                "valor": valor,
                "tendencia": tendencia,
            }
        )

    return resultado
