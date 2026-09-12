export type TipoUnidad = "kg" | "g" | "l" | "ml" | "cm3";

export const TIPOS_UNIDAD: { value: TipoUnidad; label: string }[] = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "l", label: "Litros (l)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "cm3", label: "Centímetros cúbicos (cm3)" },
];

export interface Insumo {
  id: number;
  nombre: string;
  tipo: TipoUnidad;
}
