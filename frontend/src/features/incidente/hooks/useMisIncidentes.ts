import { useState, useCallback, useEffect } from "react";
import { listarMisIncidentes } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

export function useMisIncidentes() {
  const [misIncidentes, setMisIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarMisIncidentes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarMisIncidentes();
      setMisIncidentes(data);
    } catch {
      setError("No se pudieron cargar tus incidentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarMisIncidentes();
  }, [cargarMisIncidentes]);

  return { misIncidentes, loading, error, cargarMisIncidentes };
}