import { useCallback, useEffect, useState } from "react";
import { obtenerIncidente } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

export function useIncidente(id: number | null) {
  const [incidente, setIncidente] = useState<Incidente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarIncidente = useCallback(async () => {
    if (id === null || isNaN(id)) return;
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerIncidente(id);
      setIncidente(data);
    } catch (err) {
      setError("No se pudo cargar el incidente");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargarIncidente();
  }, [cargarIncidente]);

  return { incidente, loading, error, recargar: cargarIncidente };
}