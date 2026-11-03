import { useCallback, useEffect, useRef } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerNotificaciones } from "../services/notificacionService";
import type { Notificacion } from "../types/notificacion";

/** Cada cuánto se refresca la campana mientras la pestaña está visible. */
const INTERVALO_REFRESCO_MS = 60_000;
/** Evita pedidos duplicados cuando `focus` y `visibilitychange` saltan juntos. */
const MIN_ENTRE_REFRESCOS_MS = 2_000;

export function useNotificaciones() {
  const cargarNotificaciones = useCallback(() => obtenerNotificaciones(), []);

  const { items, loading, error, recargar } = useLista<Notificacion[]>({
    cargar: cargarNotificaciones,
    dependencias: [],
    valorInicial: [],
    mensajeError: "Error al obtener notificaciones",
    preferirMensajeDelBackend: true,
  });

  // El backend recalcula las alertas una vez por día y ante cambios. Para que la
  // campana no se quede con datos de ayer (o de otra pestaña) se refresca sola:
  // al volver a la pestaña y cada tanto mientras está visible. `recargar` va en
  // un ref para no re-suscribir los listeners si su identidad cambia.
  const recargarRef = useRef(recargar);
  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);

  useEffect(() => {
    let ultimo = Date.now();
    const refrescar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimo < MIN_ENTRE_REFRESCOS_MS) return;
      ultimo = Date.now();
      void recargarRef.current();
    };
    const id = window.setInterval(refrescar, INTERVALO_REFRESCO_MS);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, []);

  // La campana vive en el Navbar, o sea en todas las pantallas. Si el backend
  // devolviera algo que no es un array (null, undefined, un objeto), leer
  // `items.length` tira "Cannot read properties of null" y tumba el Navbar
  // entero: con él se cae también la sesión recién iniciada. Se normaliza acá
  // para que el peor caso sea "0 notificaciones".
  const notificaciones = Array.isArray(items) ? items : [];

  return {
    notificaciones,
    cantidad: notificaciones.length,
    loading,
    error,
    recargar,
  };
}