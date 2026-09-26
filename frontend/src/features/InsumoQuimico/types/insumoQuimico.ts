export type TipoQuimico = "detergente" | "desinfectante" | "desengrasante" | "sanitizante";
export type UnidadMedidaQuimico = "l" | "ml" | "kg" | "g" | "dosis";

export interface InsumoQuimico {
  id: number;
  nombre: string;
  tipo: TipoQuimico;
  unidad_medida: UnidadMedidaQuimico;
  stock: number;
  activo: boolean;
}

export const TIPOS_QUIMICOS: { value: TipoQuimico; label: string }[] = [
  { value: "detergente", label: "Detergente" },
  { value: "desinfectante", label: "Desinfectante" },
  { value: "desengrasante", label: "Desengrasante" },
  { value: "sanitizante", label: "Sanitizante" },
];

export const UNIDADES_MEDIDA: { value: UnidadMedidaQuimico; label: string }[] = [
  { value: "l", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (mL)" },
  { value: "kg", label: "Kilogramos (Kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "dosis", label: "Dosis" },
];

