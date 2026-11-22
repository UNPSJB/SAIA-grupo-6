import type { AditivoResumen } from "../../aditivos/types/aditivo";

/** Texto de la columna "Aditivo" de la receta. */
export const etiquetaEsAditivo = (esAditivo: boolean) => (esAditivo ? "Sí" : "No");

export interface UnidadResumen {
  id: number;
  nombre: string;
  simbolo: string;
}

export interface IngredienteResumen {
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
  vida_util_dias: number | null;
  creado_en: string;
  creado_por_id: number | null;
  creado_por_nombre: string | null;
}

export interface Receta {
  id: number;
  producto_id: number;
  producto_nombre: string;
  activo: boolean;
  version_vigente: VersionResumen | null;
}

export interface RecetaIngredienteDetalle {
  id: number;
  ingrediente: IngredienteResumen;
  cantidad: string;
  unidad_medida: UnidadResumen;
  /** Copia de la marca del maestro al guardar la versión. */
  es_aditivo: boolean;
  aditivo: AditivoResumen | null;
}

export interface TareaIngredienteDetalle {
  receta_ingrediente_id: number;
  ingrediente: IngredienteResumen;
  cantidad: string;
}

export interface TareaDetalle {
  id: number;
  orden: number;
  descripcion: string;
  /** Cómo se hace la etapa, paso a paso (opcional). */
  procedimiento: string | null;
  ingredientes: TareaIngredienteDetalle[];
}

export interface VersionDetalle extends VersionResumen {
  receta_id: number;
  ingredientes: RecetaIngredienteDetalle[];
  tareas: TareaDetalle[];
}

/** Lo que se envía al backend. */
export interface VersionInput {
  rendimiento: string;
  unidad_medida_id: number;
  porcion_descripcion: string | null;
  porcion_cantidad: string | null;
  porcion_unidad_medida_id: number | null;
  vida_util_dias?: number | null;
  ingredientes: {
    ingrediente_id: number;
    cantidad: string;
    unidad_medida_id: number;
  }[];
  tareas: {
    descripcion: string;
    procedimiento: string | null;
    ingredientes: { ingrediente_id: number; cantidad: string }[];
  }[];
}

export interface RecetaCreateInput {
  producto_id: number;
  version: VersionInput;
}

/** Estado editable del formulario (todo texto, como lo escribe la persona). */
export interface FilaIngredienteForm {
  clave: string;
  ingrediente_id: number;
  cantidad: string;
}

export interface FilaUsoForm {
  clave: string;
  ingrediente_id: number;
  cantidad: string;
}

export interface FilaTareaForm {
  clave: string;
  descripcion: string;
  procedimiento: string;
  usos: FilaUsoForm[];
}

export interface VersionFormState {
  rendimiento: string;
  unidad_medida_id: number;
  porcion_descripcion: string;
  porcion_cantidad: string;
  porcion_unidad_medida_id: number;
  vida_util_dias: string;
  ingredientes: FilaIngredienteForm[];
  tareas: FilaTareaForm[];
}

export interface IngredienteOpcion {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadResumen;
  es_aditivo: boolean;
  aditivo: AditivoResumen | null;
}

// ------------------------------------------------------------------
// Escalado (vista de cálculo: no modifica la receta)
// ------------------------------------------------------------------

export interface IngredienteEscalado {
  ingrediente: IngredienteResumen;
  /** Copia de la marca del maestro al guardar la versión. */
  es_aditivo: boolean;
  aditivo: AditivoResumen | null;
  unidad_medida: UnidadResumen;
  cantidad_receta: string;
  cantidad_escalada: string;
}

export interface TareaEscalada {
  orden: number;
  descripcion: string;
  ingredientes: {
    ingrediente: IngredienteResumen;
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
  ingredientes: IngredienteEscalado[];
  tareas: TareaEscalada[];
}

export interface ComposicionItem {
  ingrediente: IngredienteResumen;
  unidad_medida: UnidadResumen;
  cantidad: string;
  gramos: string;
  porcentaje: string;
}

export interface ComposicionFaltante {
  ingrediente: IngredienteResumen;
  /** Copia de la marca del maestro al guardar la versión. */
  es_aditivo: boolean;
  motivo: string;
}

export interface Composicion {
  version_id: number;
  version_numero: number;
  receta_id: number;
  producto_nombre: string;
  completa: boolean;
  total_gramos: string | null;
  ingredientes: ComposicionItem[];
  aditivos: ComposicionItem[];
  suma_porcentajes: string | null;
  suma_correcta: boolean | null;
  faltantes: ComposicionFaltante[];
}




export type ModoEscalado = "cantidad" | "factor";
