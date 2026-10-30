export type ValorDecimal = number | string;

export interface StockInsumoQuimico {
  insumo_quimico_id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_simbolo: string | null;
  activo: boolean;
  cantidad_actual: ValorDecimal;
  stock_minimo: ValorDecimal | null;
  stock_bajo: boolean;
}

export type OperacionAjusteStock = "incremento" | "decremento";

export interface MovimientoStock {
  id: number;
  fecha: string;
  tipo: string;
  cantidad_variacion: ValorDecimal;
  nombre_producto: string;
  unidad_simbolo: string | null;
  responsable_nombre: string | null;
  motivo: string | null;
  checklist_id: number | null;
  registro_tarea_id: number | null;
  tarea_nombre: string | null;
  checklist_fecha: string | null;
}

export interface MovimientosStockResponse {
  items: MovimientoStock[];
  total: number;
  limit: number;
  offset: number;
}

export interface FiltrosMovimientosStock {
  insumo_quimico_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
}

export interface LoteStock {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string;
  insumo_quimico_id: number;
  nombre_producto: string;
  unidad_simbolo: string | null;
  numero_lote: string;
  cantidad_producto: ValorDecimal;
  fecha_ingreso: string;
  movimiento_ingreso_id: number;
}

export interface LotesStockResponse {
  items: LoteStock[];
  total: number;
  limit: number;
  offset: number;
}

export interface FiltrosLotesStock {
  proveedor_id?: number;
  insumo_quimico_id?: number;
  numero_lote?: string;
  limit?: number;
  offset?: number;
}
