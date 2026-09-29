export interface UnidadMedidaInfo {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface Insumo {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadMedidaInfo;
  activo: boolean;
}

export type InsumoFormValues = Omit<Insumo, "id" | "activo" | "unidad_medida">;
