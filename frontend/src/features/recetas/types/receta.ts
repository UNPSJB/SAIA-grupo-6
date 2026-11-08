import type { AditivoResumen } from "../../aditivos/types/aditivo";

/** Sale del tipo del insumo en el maestro; la versión guarda una copia. */
export type Clasificacion = "ingrediente" | "aditivo";

export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  ingrediente: "Ingrediente",
  aditivo: "Aditivo",
};

export interface UnidadResumen {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface InsumoResumen {
  id: number;
  nombre: string;
}

export interface VersionResumen {
  id: number;
  numero: number;
  rendimiento: string;
  unidad_medida: UnidadResumen;
  /** Porción o unidad de venta (opcional). */
  porcion_descripcion: string | null;
  porcion_cantidad: string | null;
  porcion_unidad_medida: UnidadResumen | null;
  creado_en: string;
  creado_por_id: number | null;
}

export interface Receta {
  id: number;
  producto_id: number;
  producto_nombre: string;
  activo: boolean;
  version_vigente: VersionResumen | null;
}

export interface RecetaInsumoDetalle {
  id: number;
  insumo: InsumoResumen;
  cantidad: string;
  unidad_medida: UnidadResumen;
  clasificacion: Clasificacion;
  aditivo: AditivoResumen | null;
}

export interface TareaInsumoDetalle {
  receta_insumo_id: number;
  insumo: InsumoResumen;
  cantidad: string;
}

export interface TareaDetalle {
  id: number;
  orden: number;
  descripcion: string;
  insumos: TareaInsumoDetalle[];
}

export interface VersionDetalle extends VersionResumen {
  receta_id: number;
  insumos: RecetaInsumoDetalle[];
  tareas: TareaDetalle[];
}

/** Lo que se envía al backend. */
export interface VersionInput {
  rendimiento: string;
  unidad_medida_id: number;
  porcion_descripcion: string | null;
  porcion_cantidad: string | null;
  porcion_unidad_medida_id: number | null;
  insumos: {
    insumo_id: number;
    cantidad: string;
    unidad_medida_id: number;
  }[];
  tareas: {
    descripcion: string;
    insumos: { insumo_id: number; cantidad: string }[];
  }[];
}

export interface RecetaCreateInput {
  producto_id: number;
  version: VersionInput;
}

/** Estado editable del formulario (todo texto, como lo escribe la persona). */
export interface FilaInsumoForm {
  clave: string;
  insumo_id: number;
  cantidad: string;
}

export interface FilaUsoForm {
  clave: string;
  insumo_id: number;
  cantidad: string;
}

export interface FilaTareaForm {
  clave: string;
  descripcion: string;
  usos: FilaUsoForm[];
}

export interface VersionFormState {
  rendimiento: string;
  unidad_medida_id: number;
  porcion_descripcion: string;
  porcion_cantidad: string;
  porcion_unidad_medida_id: number;
  insumos: FilaInsumoForm[];
  tareas: FilaTareaForm[];
}

export interface InsumoOpcion {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadResumen;
  tipo: Clasificacion;
  aditivo: AditivoResumen | null;
}

// ------------------------------------------------------------------
// Escalado (vista de cálculo: no modifica la receta)
// ------------------------------------------------------------------

export interface InsumoEscalado {
  insumo: InsumoResumen;
  clasificacion: Clasificacion;
  aditivo: AditivoResumen | null;
  unidad_medida: UnidadResumen;
  cantidad_receta: string;
  cantidad_escalada: string;
}

export interface TareaEscalada {
  orden: number;
  descripcion: string;
  insumos: {
    insumo: InsumoResumen;
    unidad_medida: UnidadResumen;
    cantidad_receta: string;
    cantidad_escalada: string;
  }[];
}

export interface RecetaEscalada {
  receta_id: number;
  producto_id: number;
  producto_nombre: string;
  version: VersionResumen;
  factor: string;
  cantidad_objetivo: string;
  insumos: InsumoEscalado[];
  tareas: TareaEscalada[];
}

export type ModoEscalado = "cantidad" | "factor";
