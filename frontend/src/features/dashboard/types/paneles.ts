import { formatoCantidad } from "../../../common/utils/numeros";
import type { TonoEstado } from "../../../components/ui/patrones";

/*
 * Respuestas de `GET /paneles/{categoria}` (backend `src/paneles/schemas.py`).
 *
 * Cada panel es UNA respuesta ya agregada: acá no se cuenta nada, solo se
 * dibuja. Las piezas compartidas (`Conteo`, `Serie`, `FilaAtencion`) son las
 * mismas en los seis paneles, igual que los gráficos que las muestran.
 */

export type CategoriaPanel =
  | "produccion"
  | "inventario"
  | "limpieza"
  | "equipos"
  | "calidad"
  | "personas";

export type Granularidad = "dia" | "semana" | "mes";

export interface Periodo {
  desde: string;
  hasta: string;
}

export interface Opcion {
  valor: string;
  etiqueta: string;
}

/** Una barra o una porción: cuánto hay de una categoría. */
export interface Conteo {
  clave: string;
  etiqueta: string;
  valor: number;
  detalle: string | null;
}

export interface PuntoSerie {
  /** Primer día del tramo, `YYYY-MM-DD`. */
  clave: string;
  etiqueta: string;
  /** `null`: no hay dato en el tramo (un % sin tareas programadas). */
  valores: Record<string, number | null>;
}

export interface Serie {
  granularidad: Granularidad;
  puntos: PuntoSerie[];
}

/** Una medida cruzada por categoría (filas) y tramo de tiempo (columnas). */
export interface MapaCalor {
  granularidad: Granularidad;
  columnas: string[];
  filas: { clave: string; etiqueta: string; valores: (number | null)[] }[];
}

export interface FilaAtencion {
  clave: string;
  titulo: string;
  detalle: string | null;
  tono: TonoEstado;
  estado: string;
  link: string | null;
}

export interface Avance {
  clave: string;
  etiqueta: string;
  cumplen: number;
  total: number;
}

/** Lo terminado un día en una unidad, con qué aportó cada producto (de mayor a menor). */
export interface ProduccionDelDia {
  /** `YYYY-MM-DD`. */
  fecha: string;
  unidad: string;
  cantidad: number;
  cantidad_lotes: number;
  productos: { producto: string; cantidad: number; cantidad_lotes: number }[];
}

export interface PanelProduccion {
  periodo: Periodo;
  productos: Opcion[];
  lotes_en_proceso: number;
  lotes_iniciados: number;
  lotes_terminados: number;
  lotes_cancelados: number;
  salidas_registradas: number;
  salidas_rechazadas: number;
  retiros_en_curso: number;
  retiros_periodo: number;
  serie_lotes: Serie;
  serie_lotes_por_estado: Serie;
  lotes_por_estado: Conteo[];
  /** Cantidad producida en kg; `detalle`, en la unidad del producto si no es kg ("66 un"). */
  elaborado_por_producto: Conteo[];
  /** Elaborados que no se pueden pasar a kg (sin peso por unidad o densidad), en su unidad. */
  elaborado_sin_peso: Conteo[];
  /** Terminado por día de cierre y unidad (sin pasar a kg); solo los días con producción. */
  produccion_por_dia: ProduccionDelDia[];
  serie_salidas_retiros: Serie;
  salidas_por_estado: Conteo[];
  en_proceso: FilaAtencion[];
  /** Solo llega para quien administra. */
  catalogo: {
    productos_activos: number;
    avances: Avance[];
    rotulado_pendiente: number;
    pendientes: FilaAtencion[];
  } | null;
}

export interface PanelInventario {
  periodo: Periodo;
  ingredientes_activos: number;
  ingredientes_sin_stock: number;
  lotes_vencidos: number;
  lotes_por_vencer: number;
  lotes_recibidos: number;
  proveedores_activos: number;
  proveedores_certificacion_vencida: number;
  serie_movimientos: Serie;
  lotes_por_vencimiento: Conteo[];
  ingredientes_segun_aditivo: Conteo[];
  estado_stock: Conteo[];
  mas_movimiento: Conteo[];
  recepciones_por_proveedor: Conteo[];
  vencen_primero: FilaAtencion[];
}

export interface PanelLimpieza {
  periodo: Periodo;
  sectores: Opcion[];
  solo_propias: boolean;
  tareas_total: number;
  tareas_completadas: number;
  cumplimiento: number | null;
  pendientes_hoy: number;
  tareas_incumplidas: number;
  planes_activos: number;
  tareas_activas: number;
  checklists_observados: number;
  serie_cumplimiento: Serie;
  mapa_cumplimiento: MapaCalor;
  checklists_por_estado: Conteo[];
  cumplimiento_por_sector: Conteo[];
  equipos_menor_cumplimiento: Conteo[];
  cumplimiento_por_momento: Conteo[];
  quimicos_bajo_minimo: number | null;
  elementos_recambio_vencido: number | null;
  atencion: FilaAtencion[] | null;
}

export interface EstadoPlanes {
  clave: string;
  etiqueta: string;
  al_dia: number;
  proximos: number;
  vencidos: number;
}

export interface PanelEquipos {
  periodo: Periodo;
  sectores: Opcion[];
  equipos_activos: number;
  equipos_inactivos: number;
  equipos_con_incidentes_abiertos: number;
  incidentes_abiertos: number;
  incidentes_periodo: number;
  planes_vencidos: number;
  planes_proximos: number;
  equipos_sin_plan: number;
  intervenciones_periodo: number;
  serie_incidentes: Serie;
  estado_planes: EstadoPlanes[];
  equipos_por_sector: Conteo[];
  equipos_por_tipo: Conteo[];
  equipos_mas_incidentes: Conteo[];
  proximas_intervenciones: FilaAtencion[];
}

export interface PanelCalidad {
  periodo: Periodo;
  tipos: Opcion[];
  solo_propios: boolean;
  incidentes_abiertos: number;
  incidentes_reportados: number;
  incidentes_resueltos: number;
  porcentaje_resuelto: number | null;
  dias_resolucion: number | null;
  cerrados_periodo: number;
  reclamos: number;
  reclamos_fuera_de_plazo: number;
  retiros_en_curso: number;
  serie_incidentes: Serie;
  incidentes_por_tipo: Conteo[];
  mapa_incidentes: MapaCalor;
  antiguedad_abiertos: Conteo[];
  motivos_reclamo: Conteo[];
  productos_con_reclamos: Conteo[];
  abiertos_antiguos: FilaAtencion[];
  vencimientos_vencidos: number | null;
  vencimientos_proximos: number | null;
  vencimientos_por_tipo: Conteo[] | null;
}

export interface PanelPersonas {
  periodo: Periodo;
  personal_activo: number;
  personal_inactivo: number;
  aptitudes_vencidas: number;
  aptitudes_proximas: number;
  /** Aptitudes al día: ni vencidas ni por vencer. */
  aptitudes_vigentes: number;
  clientes_activos: number;
  clientes_inactivos: number;
  transportistas_activos: number;
  transportistas_inactivos: number;
  certificaciones_transporte_vencidas: number;
  tareas_asignadas: number;
  tareas_completadas: number;
  cumplimiento_tareas: number | null;
  personal_por_rol: Conteo[];
  cumplimiento_por_operador: Conteo[];
  /** Por operador, tareas completadas (valor) en el período, de más a menos. */
  tareas_completadas_por_operador: Conteo[];
  /** Incidentes reportados por el personal en el período (todos, no solo el ranking). */
  incidentes_reportados: number;
  incidentes_por_persona: Conteo[];
  clientes_con_mas_salidas: Conteo[];
  /** Por clave de cliente: de sus salidas del período, cuántas tienen algún reclamo. */
  salidas_con_reclamo_por_cliente: Record<string, number>;
  entregas_por_transportista: Conteo[];
  certificaciones_transporte: Conteo[];
  aptitudes_atencion: FilaAtencion[];
}

/* ─────────────────────────────── Período ─────────────────────────────── */

/** Períodos que ofrece el filtro: los últimos N días, hoy incluido. */
export const PERIODOS = [
  { valor: "7", etiqueta: "Últimos 7 días" },
  { valor: "30", etiqueta: "Últimos 30 días" },
  { valor: "90", etiqueta: "Últimos 90 días" },
  { valor: "365", etiqueta: "Últimos 12 meses" },
] as const;

export const PERIODO_INICIAL = "30";

/** "Últimos 30 días" en minúscula, para completar frases: "en los últimos 30 días". */
export function textoPeriodo(dias: string): string {
  const periodo = PERIODOS.find((p) => p.valor === dias);
  return (periodo?.etiqueta ?? `Últimos ${dias} días`).toLowerCase();
}

const TEXTO_GRANULARIDAD: Record<Granularidad, string> = {
  dia: "por día",
  semana: "por semana",
  mes: "por mes",
};

export function textoGranularidad(serie: Pick<Serie, "granularidad">): string {
  return TEXTO_GRANULARIDAD[serie.granularidad];
}

/* ─────────────────────────────── Inicio ─────────────────────────────── */

/** Una cifra del día, con el enlace a donde se ve el detalle. */
export interface CifraHoy {
  clave: string;
  etiqueta: string;
  valor: number;
  detalle: string | null;
  link: string | null;
  /** "peligro" o "alerta" cuando lo de hoy pide atención; "neutro" si no. */
  tono: TonoEstado;
}

/** Las cifras de hoy de un área. */
export interface GrupoHoy {
  clave: CategoriaPanel;
  titulo: string;
  cifras: CifraHoy[];
  /** Solo Producción: lo terminado hoy, una entrada por unidad. */
  producido: ProduccionDelDia[];
}

/** El checklist de limpieza de hoy, con el alcance de quien lo pide. */
export interface ChecklistHoy {
  total: number;
  completadas: number;
  /** null si hoy no hay tareas programadas. */
  porcentaje: number | null;
  /** Meta configurada en Configuración → Indicadores. */
  meta: number;
  por_momento: Avance[];
  pendientes: FilaAtencion[];
  pendientes_total: number;
}

/** El inicio: solo lo del día de hoy. */
export interface PanelInicio {
  /** `YYYY-MM-DD`. */
  fecha: string;
  checklist: ChecklistHoy;
  /** Solo las áreas que el usuario puede ver. */
  grupos: GrupoHoy[];
  /** Lo que vence hoy; null para quien no administra. */
  vencen_hoy: FilaAtencion[] | null;
  /** Tareas pendientes de lotes en proceso (suyas o sin asignar); null para quien administra. */
  tareas_produccion?: TareaProduccionHoy[] | null;
}

/** Una tarea pendiente de un lote en proceso, para quien opera. */
export interface TareaProduccionHoy {
  lote_id: number;
  numero_lote: string;
  producto: string;
  orden: number;
  descripcion: string;
  /** true: asignada a quien pide; false: sin asignar (la puede hacer cualquiera). */
  asignada: boolean;
  /** false mientras alguna etapa anterior del lote siga pendiente. */
  habilitada: boolean;
}

/** `1 lote` / `3 lotes`. */
export function plural(n: number, uno: string, muchos: string): string {
  return `${formatoCantidad(n)} ${n === 1 ? uno : muchos}`;
}

/** `true` si ningún conteo tiene valor: el gráfico no tendría nada que mostrar. */
export function sinValores(conteos: Conteo[]): boolean {
  return conteos.every((c) => c.valor === 0);
}
