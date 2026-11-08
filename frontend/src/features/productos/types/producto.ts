export interface UnidadResumen {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  unidad_medida: UnidadResumen;
}

export interface ProductoFormValues {
  nombre: string;
  descripcion: string;
  unidad_medida_id: number;
}

export interface ProductoInput {
  nombre: string;
  descripcion?: string | null;
  unidad_medida_id: number;
}
