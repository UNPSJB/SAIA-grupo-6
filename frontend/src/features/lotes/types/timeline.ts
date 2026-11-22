export type EstadoNodoTimeline = "completado" | "en_proceso" | "pendiente";
export type TipoNodoTimeline = "inicio" | "tarea" | "cierre";

export interface ConsumoInsumoTimelineItem {
  ingrediente_nombre: string;
  cantidad: string | number;
  unidad_medida: string;
  lote_insumo_codigo: string;
  proveedor_nombre: string | null;
}

export interface DesperdicioTimelineItem {
  cantidad: string | number;
  unidad_medida: string;
  motivo: string | null;
}

export interface RendimientoTimeline {
  cantidad_objetivo: string | number;
  cantidad_producida: string | number | null;
  porcentaje_rendimiento: string | number | null;
}

export interface DetalleNodoTimeline {
  operario_nombre: string | null;
  descripcion: string | null;
  ingredientes_consumidos: ConsumoInsumoTimelineItem[];
  desperdicios: DesperdicioTimelineItem[];
  rendimiento: RendimientoTimeline | null;
}

export interface NodoTimeline {
  id: string;
  orden: number;
  tipo: TipoNodoTimeline;
  titulo: string;
  subtitulo: string | null;
  fecha_hora: string | null;
  estado: EstadoNodoTimeline;
  tiene_desvio: boolean;
  detalle: DetalleNodoTimeline;
}

export interface LoteTimelineResponse {
  lote_id: number;
  numero_lote: string;
  estado_lote: string;
  nodos: NodoTimeline[];
}
