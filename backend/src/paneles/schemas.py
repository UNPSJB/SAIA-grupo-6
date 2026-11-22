"""Respuestas de los paneles de categoría (`/paneles/...`).

Cada panel es UNA respuesta ya agregada: el frontend no trae listados
completos para contar. Las piezas se repiten entre paneles a propósito
(`Conteo`, `Serie`, `FilaAtencion`), así los gráficos del frontend son los
mismos para las seis categorías.
"""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel

Granularidad = Literal["dia", "semana", "mes"]
Tono = Literal["ok", "alerta", "peligro", "info", "neutro"]


class Periodo(BaseModel):
    desde: date
    hasta: date


class Opcion(BaseModel):
    """Opción de un filtro propio del panel (producto, sector...)."""

    valor: str
    etiqueta: str


class Conteo(BaseModel):
    """Una barra o una porción: cuánto hay de una categoría."""

    clave: str
    etiqueta: str
    valor: float
    # Aclaración junto al valor: "120 kg · 4 lotes", "8 de 10 tareas".
    detalle: Optional[str] = None


class PuntoSerie(BaseModel):
    # Primer día del tramo (día, lunes de la semana o día 1 del mes).
    clave: date
    etiqueta: str
    # `None` = no hay dato en el tramo (p. ej. un % sin tareas programadas).
    valores: dict[str, Optional[float]]


class Serie(BaseModel):
    granularidad: Granularidad
    puntos: list[PuntoSerie]


class FilaMapa(BaseModel):
    clave: str
    etiqueta: str
    # Un valor por columna; `None` = sin dato en ese tramo.
    valores: list[Optional[float]]


class MapaCalor(BaseModel):
    """Una medida cruzada por categoría (filas) y tramo de tiempo (columnas)."""

    granularidad: Granularidad
    columnas: list[str]
    filas: list[FilaMapa]


class FilaAtencion(BaseModel):
    """Un caso puntual que pide atención, con enlace a donde se resuelve."""

    clave: str
    titulo: str
    detalle: Optional[str] = None
    tono: Tono
    estado: str
    link: Optional[str] = None


class Avance(BaseModel):
    """Cuántos de un total cumplen algo (productos con receta, etc.)."""

    clave: str
    etiqueta: str
    cumplen: int
    total: int


# ───────────────────────────── Producción ─────────────────────────────


class ProductoDelDia(BaseModel):
    producto: str
    cantidad: float
    cantidad_lotes: int


class ProduccionDelDia(BaseModel):
    """Lo terminado un día en una unidad, con qué aportó cada producto."""

    fecha: date
    unidad: str
    cantidad: float
    cantidad_lotes: int
    # De mayor a menor cantidad.
    productos: list[ProductoDelDia]


class CatalogoProduccion(BaseModel):
    productos_activos: int
    avances: list[Avance]
    rotulado_pendiente: int
    pendientes: list[FilaAtencion]


class PanelProduccion(BaseModel):
    periodo: Periodo
    productos: list[Opcion]
    lotes_en_proceso: int
    lotes_iniciados: int
    lotes_terminados: int
    lotes_cancelados: int
    salidas_registradas: int
    salidas_rechazadas: int
    retiros_en_curso: int
    retiros_periodo: int
    serie_lotes: Serie
    # Lotes iniciados en cada tramo, repartidos por su estado actual.
    serie_lotes_por_estado: Serie
    lotes_por_estado: list[Conteo]
    # Cantidad producida en kg (valor); `detalle` la repite en la unidad del
    # producto cuando no es kg ("66 un").
    elaborado_por_producto: list[Conteo]
    # Productos elaborados que no se pueden pasar a kg (sin peso por unidad o
    # densidad cargados): valor y detalle en su propia unidad.
    elaborado_sin_peso: list[Conteo] = []
    # Terminado por día de cierre y unidad del producto (sin pasar a kg), solo
    # los días con producción: el gráfico de producción diaria completa los
    # días vacíos y compara productos.
    produccion_por_dia: list[ProduccionDelDia] = []
    serie_salidas_retiros: Serie
    salidas_por_estado: list[Conteo]
    en_proceso: list[FilaAtencion]
    # Solo para quien administra (productos, nutrición y rotulado).
    catalogo: Optional[CatalogoProduccion] = None


# ───────────────────────────── Inventario ─────────────────────────────


class PanelInventario(BaseModel):
    periodo: Periodo
    ingredientes_activos: int
    ingredientes_sin_stock: int
    lotes_vencidos: int
    lotes_por_vencer: int
    lotes_recibidos: int
    proveedores_activos: int
    proveedores_certificacion_vencida: int
    serie_movimientos: Serie
    lotes_por_vencimiento: list[Conteo]
    ingredientes_segun_aditivo: list[Conteo]
    estado_stock: list[Conteo]
    mas_movimiento: list[Conteo]
    recepciones_por_proveedor: list[Conteo]
    vencen_primero: list[FilaAtencion]


# ────────────────────────────── Limpieza ──────────────────────────────


class PanelLimpieza(BaseModel):
    periodo: Periodo
    sectores: list[Opcion]
    # True cuando los números son solo de las tareas asignadas al usuario.
    solo_propias: bool
    tareas_total: int
    tareas_completadas: int
    # `None` si no hubo tareas programadas en el período.
    cumplimiento: Optional[float]
    pendientes_hoy: int
    tareas_incumplidas: int
    planes_activos: int
    tareas_activas: int
    checklists_observados: int
    serie_cumplimiento: Serie
    # % de cumplimiento por sector (filas) y tramo (columnas).
    mapa_cumplimiento: MapaCalor
    checklists_por_estado: list[Conteo]
    cumplimiento_por_sector: list[Conteo]
    equipos_menor_cumplimiento: list[Conteo]
    cumplimiento_por_momento: list[Conteo]
    # Solo para quien administra.
    quimicos_bajo_minimo: Optional[int] = None
    elementos_recambio_vencido: Optional[int] = None
    atencion: Optional[list[FilaAtencion]] = None


# ─────────────────────────────── Equipos ──────────────────────────────


class EstadoPlanes(BaseModel):
    clave: str
    etiqueta: str
    al_dia: int
    proximos: int
    vencidos: int


class PanelEquipos(BaseModel):
    periodo: Periodo
    sectores: list[Opcion]
    equipos_activos: int
    equipos_inactivos: int
    equipos_con_incidentes_abiertos: int
    incidentes_abiertos: int
    incidentes_periodo: int
    planes_vencidos: int
    planes_proximos: int
    equipos_sin_plan: int
    intervenciones_periodo: int
    serie_incidentes: Serie
    estado_planes: list[EstadoPlanes]
    equipos_por_sector: list[Conteo]
    equipos_por_tipo: list[Conteo]
    equipos_mas_incidentes: list[Conteo]
    proximas_intervenciones: list[FilaAtencion]


# ─────────────────────────────── Calidad ──────────────────────────────


class PanelCalidad(BaseModel):
    periodo: Periodo
    tipos: list[Opcion]
    solo_propios: bool
    incidentes_abiertos: int
    incidentes_reportados: int
    incidentes_resueltos: int
    # `None` si no se reportó ninguno en el período.
    porcentaje_resuelto: Optional[float]
    # Días; `None` si no se cerró ninguno en el período.
    dias_resolucion: Optional[float]
    cerrados_periodo: int
    reclamos: int
    reclamos_fuera_de_plazo: int
    retiros_en_curso: int
    serie_incidentes: Serie
    incidentes_por_tipo: list[Conteo]
    # Incidentes reportados por tipo (filas) y tramo (columnas).
    mapa_incidentes: MapaCalor
    antiguedad_abiertos: list[Conteo]
    motivos_reclamo: list[Conteo]
    productos_con_reclamos: list[Conteo]
    abiertos_antiguos: list[FilaAtencion]
    # Solo para quien administra.
    vencimientos_vencidos: Optional[int] = None
    vencimientos_proximos: Optional[int] = None
    vencimientos_por_tipo: Optional[list[Conteo]] = None


# ────────────────────────────── Personas ──────────────────────────────


class PanelPersonas(BaseModel):
    periodo: Periodo
    personal_activo: int
    personal_inactivo: int
    aptitudes_vencidas: int
    aptitudes_proximas: int
    clientes_activos: int
    clientes_inactivos: int
    transportistas_activos: int
    transportistas_inactivos: int
    certificaciones_transporte_vencidas: int
    tareas_asignadas: int
    tareas_completadas: int
    cumplimiento_tareas: Optional[float]
    personal_por_rol: list[Conteo]
    cumplimiento_por_operador: list[Conteo]
    incidentes_por_persona: list[Conteo]
    clientes_con_mas_salidas: list[Conteo]
    entregas_por_transportista: list[Conteo]
    certificaciones_transporte: list[Conteo]
    aptitudes_atencion: list[FilaAtencion]


# ─────────────────────────────── Inicio ───────────────────────────────


class CifraHoy(BaseModel):
    """Una cifra del día, con el enlace a donde se ve el detalle."""

    clave: str
    etiqueta: str
    valor: float
    detalle: Optional[str] = None
    link: Optional[str] = None
    # "peligro" o "alerta" cuando lo de hoy pide atención; "neutro" si no.
    tono: Tono


class GrupoHoy(BaseModel):
    """Las cifras de hoy de un área."""

    clave: str
    titulo: str
    cifras: list[CifraHoy]
    # Solo Producción: lo terminado hoy, una entrada por unidad (kg, un...).
    producido: list[ProduccionDelDia] = []


class ChecklistHoy(BaseModel):
    """El checklist de limpieza de hoy, con el alcance de quien lo pide."""

    total: int
    completadas: int
    # `None` si hoy no hay tareas programadas.
    porcentaje: Optional[float]
    # Meta de cumplimiento configurada (Configuración → Indicadores).
    meta: int
    # Avance por momento (preoperacional, operacional, postoperacional).
    por_momento: list[Avance]
    # Las primeras tareas sin completar, y cuántas son en total.
    pendientes: list[FilaAtencion]
    pendientes_total: int


class TareaProduccionHoy(BaseModel):
    """Una tarea pendiente de un lote en proceso, para quien opera."""

    lote_id: int
    numero_lote: str
    producto: str
    orden: int
    descripcion: str
    # True: asignada a quien pide; False: sin asignar (la puede hacer cualquiera).
    asignada: bool
    # False mientras alguna etapa anterior del lote siga pendiente (va en orden).
    habilitada: bool = True


class PanelInicio(BaseModel):
    """Solo lo del día de hoy."""

    fecha: date
    checklist: ChecklistHoy
    # Solo las áreas que el usuario puede ver.
    grupos: list[GrupoHoy]
    # Lo que vence hoy; solo para quien administra.
    vencen_hoy: Optional[list[FilaAtencion]] = None
    # Tareas de producción pendientes; solo para quien opera (sin administrar).
    tareas_produccion: Optional[list[TareaProduccionHoy]] = None
