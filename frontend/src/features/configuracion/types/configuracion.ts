/** Ajustes de las alertas y del circuito de reclamos. */
export interface ConfiguracionAlertas {
  /** Con cuántos días de antelación se alerta un vencimiento del personal. */
  dias_alerta_vencimiento_personal: number;
  /**
   * Plazo de referencia (en días desde la entrega) para marcar un reclamo como
   * fuera de plazo. No bloquea el registro: solo lo etiqueta.
   */
  plazo_reclamo_dias: number;
}

/** Vista mínima que puede leer cualquier usuario autenticado. */
export interface PlazoReclamo {
  plazo_reclamo_dias: number;
}
