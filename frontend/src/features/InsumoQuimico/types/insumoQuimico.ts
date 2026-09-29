export type TipoQuimico =
  | "detergente"
  | "desinfectante"
  | "desengrasante"
  | "sanitizante";

export interface UnidadMedidaInfo {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface InsumoQuimico {
  id: number;
  nombre: string;
  tipo: TipoQuimico;
  unidad_medida_id: number;
  unidad_medida: UnidadMedidaInfo;
  activo: boolean;
}

export type InsumoQuimicoFormValues = {
  nombre: string;
  tipo: TipoQuimico;
  unidad_medida_id: number;
};

export const TIPOS_QUIMICOS: { value: TipoQuimico; label: string }[] = [
  { value: "detergente", label: "Detergente" },
  { value: "desinfectante", label: "Desinfectante" },
  { value: "desengrasante", label: "Desengrasante" },
  { value: "sanitizante", label: "Sanitizante" },
];
