import { useState, useCallback, useEffect } from "react";
import { listarAptitudes } from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

export function useAptitudes(incluirInactivos = false) {
  const [aptitudes, setAptitudes] = useState<Aptitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarAptitudes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarAptitudes(incluirInactivos);
      setAptitudes(data);
    } catch {
      setError("No se pudieron cargar las aptitudes");
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarAptitudes, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarAptitudes]);

  return { aptitudes, loading, error, cargarAptitudes };
}
