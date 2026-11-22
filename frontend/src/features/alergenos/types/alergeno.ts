export interface Alergeno {
  id: number;
  nombre: string;
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

export interface AlergenoDeIngrediente {
  alergeno_id: number;
  nombre: string;
  nivel: NivelAlergeno;
}

export interface AlergenosDeIngrediente {
  ingrediente_id: number;
  alergenos: AlergenoDeIngrediente[];
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
