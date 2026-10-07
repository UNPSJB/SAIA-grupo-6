/**
 * Bus de eventos de la campana de notificaciones.
 *
 * Antes era un string suelto: `window.dispatchEvent(new Event("actualizar_notificaciones"))`.
 * Un `CustomEvent` con nombre de string no lo verifica nadie, así que un typo
 * compila perfecto y la campana simplemente nunca se actualiza.
 *
 * Acá el nombre vive en una constante y el disparo/la escucha pasan por estas
 * dos funciones, de modo que el error solo puede aparecer en un lugar.
 */
export const EVENTO_NOTIFICACIONES = "actualizar_notificaciones";

/** Avisa que cambiaron las notificaciones (para que se refresque la campana). */
export function notificarCambioNotificaciones(): void {
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
}

/**
 * Se suscribe a los cambios. Devuelve la función para desuscribirse, para
 * usarla en el cleanup del `useEffect`.
 */
export function escucharCambioNotificaciones(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO_NOTIFICACIONES, alCambiar);
  return () => window.removeEventListener(EVENTO_NOTIFICACIONES, alCambiar);
}