export interface UnidadMedidaInfo {
  id: number;
  nombre: string;
  simbolo: string;
}

export type TipoInsumo = "insumo" | "producto";

export interface Insumo {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadMedidaInfo;
  activo: boolean;
  tipo: TipoInsumo;
}

export type InsumoFormValues = Omit<
  Insumo,
  "id" | "activo" | "unidad_medida" | "tipo"
>;
