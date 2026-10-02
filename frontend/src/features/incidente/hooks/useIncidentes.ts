import { useState, useCallback, useEffect } from "react";
import { listarIncidentes } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

export function useIncidentes(incluirInactivos = false) {
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarIncidentes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarIncidentes(incluirInactivos);
      setIncidentes(data);
    } catch (err) {
      setError("No se pudieron cargar los incidentes");
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    cargarIncidentes();
  }, [cargarIncidentes]);

  return { incidentes, loading, error, cargarIncidentes };
}
