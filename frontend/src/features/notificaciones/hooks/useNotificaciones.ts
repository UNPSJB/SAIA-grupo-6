import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerNotificaciones } from "../services/notificacionService";
import type { Notificacion } from "../types/notificacion";

export function useNotificaciones() {
  const cargarNotificaciones = useCallback(() => obtenerNotificaciones(), []);

  const { items, loading, error, recargar } = useLista<Notificacion[]>({
    cargar: cargarNotificaciones,
    dependencias: [],
    valorInicial: [],
    mensajeError: "Error al obtener notificaciones",
    preferirMensajeDelBackend: true,
  });

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