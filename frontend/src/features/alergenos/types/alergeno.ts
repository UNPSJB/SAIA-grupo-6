export interface Alergeno {
  id: number;
  /** Identificador estable ("leche"): lo guardan las revisiones del rótulo. */
  codigo: string;
  nombre: string;
  /** Se declara según una evaluación del producto final (los sulfitos). */
  condicionada: boolean;
  activo: boolean;
}

/**
 * Contiene: es parte de la formulación. Puede contener: trazas por contacto
 * cruzado. Se declaran distinto en el rótulo.
 */
export type NivelAlergeno = "contiene" | "puede_contener";

export const ETIQUETA_NIVEL: Record<NivelAlergeno, string> = {
  contiene: "Contiene",
  puede_contener: "Puede contener",
};

/** "derivado": lo contiene a través de un derivado (lecitina de soja, suero de leche). */
export type FormaAlergeno = "directa" | "derivado";

/** Sin evaluar o incompleta deja pendiente la declaración del rótulo. */
export type EvaluacionAlergenos = "sin_evaluar" | "incompleta" | "evaluada";
export type EstadoGluten = "desconocido" | "presente" | "ausencia_declarada";

export const ETIQUETA_EVALUACION: Record<EvaluacionAlergenos, string> = {
  sin_evaluar: "Sin evaluar",
  incompleta: "Incompleta",
  evaluada: "Evaluada",
};

export const ETIQUETA_GLUTEN: Record<EstadoGluten, string> = {
  desconocido: "Información desconocida",
  presente: "Presente",
  ausencia_declarada: "Ausencia declarada en este ingrediente",
};

export interface AlergenoDeIngrediente {
  alergeno_id: number;
  codigo: string;
  nombre: string;
  nivel: NivelAlergeno;
  forma: FormaAlergeno;
}

export interface AlergenosDeIngrediente {
  ingrediente_id: number;
  alergenos: AlergenoDeIngrediente[];
  evaluacion: EvaluacionAlergenos;
  gluten: EstadoGluten;
  respaldo: string | null;
  observaciones: string | null;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

export interface AlergenosDeIngredienteInput {
  alergenos: { alergeno_id: number; nivel: NivelAlergeno; forma: FormaAlergeno }[];
  evaluacion: EvaluacionAlergenos;
  gluten: EstadoGluten;
  respaldo: string | null;
  observaciones: string | null;
}

export interface AlergenoDeProducto {
  alergeno_id: number;
  nombre: string;
  /** Ingredientes de la receta que lo aportan. */
  ingredientes: string[];
}

export interface AlergenosDeProducto {
  producto_id: number;
  version_id: number | null;
  contiene: AlergenoDeProducto[];
  puede_contener: AlergenoDeProducto[];
  /** Texto para el rótulo ("Contiene: ... Puede contener: ..."). */
  leyenda: string | null;
}
