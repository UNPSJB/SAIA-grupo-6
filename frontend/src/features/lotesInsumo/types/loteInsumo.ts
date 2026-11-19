export type MotivoBajaInsumo =
  | "danado"
  | "vencido"
  | "contaminado"
  | "devuelto_proveedor";

export const MOTIVOS_BAJA_INSUMO: { valor: MotivoBajaInsumo; etiqueta: string }[] = [
  { valor: "danado", etiqueta: "Dañado" },
  { valor: "vencido", etiqueta: "Vencido" },
  { valor: "contaminado", etiqueta: "Contaminado" },
  { valor: "devuelto_proveedor", etiqueta: "Devuelto al proveedor" },
];

export interface StockLoteInsumo {
  lote_insumo_id: number;
  insumo_id: number;
  insumo_nombre: string;
  unidad: string;
  proveedor_id: number;
  proveedor_nombre: string;
  numero_lote: string;
  fecha_vencimiento: string | null;
  activo: boolean;
  vencido: boolean;
  motivo_baja: string | null;
  fecha_baja: string | null;
  dado_de_baja_por_nombre: string | null;
  cantidad_recibida: string;
  consumo_real: string;
  desperdicio: string;
  cantidad_baja: string;
  saldo: string;
}

export interface StockInsumo {
  insumo_id: number;
  insumo_nombre: string;
  unidad: string;
  cantidad_recibida: string;
  consumo_real: string;
  desperdicio: string;
  cantidad_baja: string;
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

export interface BajaLoteInsumoInput {
  motivo: MotivoBajaInsumo;
  cantidad: string;
  observaciones?: string | null;
  foto_data_url?: string | null;
  dar_de_baja_lote_completo?: boolean;
}

export interface BajaLoteInsumoRegistro {
  id: number;
  lote_insumo_id: number;
  motivo: MotivoBajaInsumo;
  motivo_etiqueta: string;
  observaciones: string | null;
  cantidad: string;
  tiene_foto: boolean;
  foto_data_url: string | null;
  registrado_por_id: number;
  registrado_por_nombre: string;
  registrado_en: string;
}

export interface IndicadorBajasPorMotivoItem {
  motivo: MotivoBajaInsumo;
  etiqueta: string;
  cantidad_registros: number;
  cantidad_total: string;
}

export interface IndicadorBajasResponse {
  total_registros: number;
  por_motivo: IndicadorBajasPorMotivoItem[];
}

export interface InsumoOpcion {
  id: number;
  nombre: string;
  unidad_medida: { id: number; nombre: string; simbolo: string };
}
