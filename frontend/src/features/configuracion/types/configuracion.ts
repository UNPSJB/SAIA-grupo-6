/** Ajustes de las alertas y del circuito de reclamos. */
export interface ConfiguracionAlertas {
  /** Con cuántos días de antelación se alerta un vencimiento del personal. */
  dias_alerta_vencimiento_personal: number;
  /**
   * Plazo de referencia (en días desde la entrega) para marcar un reclamo como
   * fuera de plazo. No bloquea el registro: solo lo etiqueta.
   */
  plazo_reclamo_dias: number;
  /**
   * Meta de cumplimiento de las tareas de limpieza, en porcentaje (1 a 100).
   * Por debajo, el inicio marca Limpieza como "Para revisar".
   */
  meta_cumplimiento_limpieza: number;
}

/** Vista mínima que puede leer cualquier usuario autenticado. */
export interface PlazoReclamo {
  plazo_reclamo_dias: number;
}

/**
 * Impacto base de un tipo de situación del motor de riesgos: la gravedad
 * potencial de sus consecuencias (1 bajo, 2 medio, 3 alto). SAIA sugiere una
 * clasificación y el administrador puede cambiarla.
 */
export interface ImpactoSituacion {
  /** Clave del tipo de situación, ej. `INCIDENTE_ABIERTO`. */
  tipo: string;
  etiqueta: string;
  /** El que usa el motor hoy. */
  impacto: number;
  /** El que sugiere SAIA. */
  impacto_sugerido: number;
  /** `true` si el administrador lo cambió respecto del sugerido. */
  modificado: boolean;
}

export const ETIQUETA_IMPACTO: Record<number, string> = {
  1: "Bajo",
  2: "Medio",
  3: "Alto",
};
