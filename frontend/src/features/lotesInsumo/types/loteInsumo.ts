export interface StockLoteInsumo {
  lote_insumo_id: number;
  insumo_id: number;
  insumo_nombre: string;
  proveedor_id: number;
  proveedor_nombre: string;
  numero_lote: string;
  fecha_vencimiento: string | null;
  activo: boolean;
  vencido: boolean;
  cantidad_recibida: string;
  consumo_real: string;
  desperdicio: string;
  saldo: string;
}

export interface StockInsumo {
  insumo_id: number;
  insumo_nombre: string;
  unidad: string;
  cantidad_recibida: string;
  consumo_real: string;
  desperdicio: string;
  stock: string;
  stock_vencido: string;
}

export interface LoteInsumoInput {
  insumo_id: number;
  proveedor_id: number;
  numero_lote: string;
  cantidad_recibida: string;
  fecha_ingreso?: string | null;
  fecha_vencimiento?: string | null;
}

export interface InsumoOpcion {
  id: number;
  nombre: string;
  unidad_medida: { id: number; nombre: string; simbolo: string };
}
