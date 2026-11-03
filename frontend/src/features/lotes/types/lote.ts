export interface UnidadMedidaResumen {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface InsumoResumen {
  id: number;
  nombre: string;
  unidad_medida: UnidadMedidaResumen;
}

export interface InsumoLote {
  id: number;
  lote_id: number;
  insumo_id: number;
  cantidad: string;
  fecha_registro: string;
  insumo: InsumoResumen;
}

export interface Lote {
  id: number;
  codigo_lote: string;
  producto_nombre: string;
  cantidad_planificada: number;
  cantidad_producida: number;
  estado: string;
  fecha_inicio: string;
  insumos: InsumoLote[];
}

export interface Producto {
  id: number;
  nombre: string;
}

export interface ProduccionPorProducto {
  producto: string;
  cantidad_producida: number;
  cantidad_lotes: number;
}

export interface LoteResumenEstado {
  estado: string;
  cantidad: number;
}

export interface DashboardLotes {
  total_lotes: number;
  total_cantidad_planificada: number;
  total_cantidad_producida: number;
  porcentaje_cumplimiento: number;
  por_estado: LoteResumenEstado[];
  por_producto: ProduccionPorProducto[];
}

export interface FiltrosLotes {
  producto?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface LoteCreateValues {
  producto_nombre: string;
  cantidad_producida: number;
  fecha_inicio: string;
}

export interface InsumoLoteInput {
  insumo_id: number;
  cantidad: string;
}
