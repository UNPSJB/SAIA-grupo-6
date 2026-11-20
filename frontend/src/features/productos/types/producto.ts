import type { Conservacion } from "../../rotulado/types/declaraciones";
export interface UnidadResumen {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface Producto {
  conservacion?: Conservacion | null;
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  unidad_medida: UnidadResumen;
}

export interface ProductoFormValues {
  conservacion?: Conservacion | null;
  nombre: string;
  descripcion: string;
  unidad_medida_id: number;
}

export interface ProductoInput {
  conservacion?: Conservacion | null;
  nombre: string;
  descripcion?: string | null;
  unidad_medida_id: number;
}
