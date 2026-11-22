export interface ClaseFuncional {
  id: number;
  nombre: string;
  /** Las clases que se declaran solo por su función (aromatizantes). */
  ins_opcional: boolean;
  activo: boolean;
}

/** Entrada de la lista de referencia (Codex / CAA) para completar un ingrediente aditivo. */
export interface SugerenciaAditivo {
  nombre: string;
  numero_ins: string | null;
  clase_funcional: string;
  /** null si la clase no existe o está dada de baja en la app. */
  clase_funcional_id: number | null;
}

/** Lo que muestran el ingrediente y la receta de un aditivo. */
export interface AditivoResumen {
  id: number;
  nombre: string;
  numero_ins: string | null;
  clase_funcional: string;
}

export interface ClaseFuncionalInput {
  nombre: string;
  ins_opcional: boolean;
}

/**
 * "Conservante · INS 202". El nombre no va: es el del propio ingrediente, que
 * ya se muestra al lado.
 */
export function etiquetaAditivo(aditivo: AditivoResumen | null | undefined): string {
  if (!aditivo) return "-";
  return aditivo.numero_ins ? `${aditivo.clase_funcional} · INS ${aditivo.numero_ins}` : aditivo.clase_funcional;
}
