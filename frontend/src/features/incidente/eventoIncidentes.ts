/**
 * Bus de eventos de incidentes.
 *
 * Igual que el de notificaciones: el nombre vive en una constante y el
 * disparo/la escucha pasan por estas dos funciones, así un typo no compila
 * y la vista simplemente no se actualiza (en vez de fallar en silencio).
 */
export const EVENTO_INCIDENTES = "actualizar_incidentes";

/** Avisa que cambiaron los incidentes (para que se refresque la estadística). */
export function notificarCambioIncidentes(): void {
  window.dispatchEvent(new Event(EVENTO_INCIDENTES));
}

/**
 * Se suscribe a los cambios. Devuelve la función para desuscribirse, para
 * usarla en el cleanup del `useEffect`.
 */
export function escucharCambioIncidentes(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO_INCIDENTES, alCambiar);
  return () => window.removeEventListener(EVENTO_INCIDENTES, alCambiar);
}
