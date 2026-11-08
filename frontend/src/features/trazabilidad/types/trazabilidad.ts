import type { InsumoPlanificado, LoteResumen } from "../../lotes/types/lote";

export interface UsuarioResumen {
  id: number;
  nombre: string;
}

export interface ProveedorTraza {
  id: number;
  nombre: string;
  matricula: string;
}

export interface LoteInsumoTraza {
  id: number;
  insumo_id: number;
  insumo_nombre: string;
  numero_lote: string;
  fecha_ingreso: string;
  fecha_vencimiento: string | null;
  activo: boolean;
  proveedor: ProveedorTraza;
}

export interface ConsumoTraza {
  id: number;
  tipo: "real" | "desperdicio";
  cantidad: string;
  unidad: string;
  motivo: string | null;
  registrado_por: UsuarioResumen | null;
  registrado_en: string;
  lote_insumo: LoteInsumoTraza;
}

export interface TareaTraza {
  item_id: number;
  orden: number;
  descripcion: string;
  completado_por: UsuarioResumen | null;
  completado_en: string | null;
  planificado: InsumoPlanificado[];
  consumos: ConsumoTraza[];
}

export interface RecetaTraza {
  receta_id: number;
  version_id: number;
  version_numero: number;
  rendimiento: string;
  unidad: string;
  creada_en: string;
  creada_por: UsuarioResumen | null;
}

export interface TrazabilidadLoteProducto {
  lote: LoteResumen;
  elaborado_por: UsuarioResumen | null;
  receta: RecetaTraza | null;
  tareas: TareaTraza[];
  lotes_insumo: LoteInsumoTraza[];
  proveedores: ProveedorTraza[];
}

export interface LoteProductoUsoInsumo {
  lote_producto_id: number;
  numero_lote: string;
  producto_id: number;
  producto_nombre: string;
  estado: string;
  fecha_inicio: string;
  consumo_real: string;
  desperdicio: string;
}

export interface TrazabilidadLoteInsumo {
  lote_insumo: LoteInsumoTraza;
  cantidad_recibida: string;
  saldo: string;
  lotes_producto: LoteProductoUsoInsumo[];
}
