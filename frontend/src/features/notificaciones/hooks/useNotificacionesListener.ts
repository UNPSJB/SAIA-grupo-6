import { useEffect } from "react";
import { escucharCambioNotificaciones, notificarCambioNotificaciones } from "../eventoNotificaciones";

/**
 * Hook para usar en cualquier componente que realice mutaciones que afectan
 * a las notificaciones (crear/cerrar incidentes, cambiar vencimientos,
 * modificar stock, etc.).
 *
 * Escucha el evento global `actualizar_notificaciones` y, al recibirlo,
 * refresca las notificaciones de la campana. También expone
 * `notificarCambioNotificaciones` para disparar el evento desde este mismo
 * componente después de una mutación exitosa.
 *
 * Uso:
 *   const { notificarCambio } = useNotificacionesListener(recargarNotificaciones);
 *   await cerrarIncidente(id);
 *   notificarCambio();
 */
export function useNotificacionesListener(
  alCambiar?: () => void
): { notificarCambio: () => void } {
  useEffect(() => {
    const unsub = escucharCambioNotificaciones(() => {
      alCambiar?.();
    });
    return unsub;
  }, [alCambiar]);

  return {
    notificarCambio: notificarCambioNotificaciones,
  };
}
