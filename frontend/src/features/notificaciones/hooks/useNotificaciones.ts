import { useEffect, useState, useCallback } from "react";
import { obtenerNotificaciones } from "../services/notificacionService";
import type { Notificacion } from "../types/notificacion";

export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarNotificaciones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerNotificaciones();
      setNotificaciones(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al obtener notificaciones"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  return {
    notificaciones,
    cantidad: notificaciones.length,
    loading,
    error,
    recargar: cargarNotificaciones,
  };
}
