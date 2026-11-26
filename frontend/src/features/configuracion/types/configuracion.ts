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
 * Configuración de un tipo de situación del motor de riesgos. SAIA sugiere una
 * clasificación y el administrador decide: si genera riesgo, su impacto (1
 * bajo, 2 medio, 3 alto), si exige plan de acción desde la primera detección
 * y, en reclamos, retiros y rechazos, qué causas cuentan.
 */
export interface ImpactoSituacion {
  /** Clave del tipo de situación, ej. `INCIDENTE_ABIERTO`. */
  tipo: string;
  etiqueta: string;
  /** El que usa el motor hoy. */
  impacto: number;
  /** El que sugiere SAIA. */
  impacto_sugerido: number;
  /** Genera riesgo (si no, solo se notifica). */
  activo: boolean;
  activo_sugerido: boolean;
  /** Exige plan de acción desde la primera detección. */
  plan_obligatorio: boolean;
  plan_obligatorio_sugerido: boolean;
  /** Solo reclamos, retiros y rechazos: qué causas cuentan. */
  causas: CausaSituacion[];
  /** `true` si el administrador cambió algo respecto de lo sugerido. */
  modificado: boolean;
}

/** Una causa de un reclamo, retiro o rechazo. */
export interface CausaSituacion {
  valor: string;
  etiqueta: string;
  /** Con esta causa, el incidente genera riesgo. */
  cuenta: boolean;
  sugerida: boolean;
}

/** Cambios parciales: lo que no se manda queda como estaba. */
export interface CambioSituacion {
  impacto?: number;
  activo?: boolean;
  plan_obligatorio?: boolean;
  causas?: string[];
}

export const ETIQUETA_IMPACTO: Record<number, string> = {
  1: "Bajo",
  2: "Medio",
  3: "Alto",
};
