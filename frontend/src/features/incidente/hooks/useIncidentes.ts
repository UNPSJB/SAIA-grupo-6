import { useState, useCallback, useEffect } from "react";
import { listarIncidentes } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Carga el listado de incidentes.
 * @param estado Filtro por estado; "" o undefined trae todos.
 */
export function useIncidentes(estado: EstadoIncidente | "" = "") {
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarIncidentes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarIncidentes(estado);
      setIncidentes(data);
    } catch {
      setError("No se pudieron cargar los incidentes");
    } finally {
      setLoading(false);
    }
  }, [estado]);

  useEffect(() => {
    cargarIncidentes();
  }, [cargarIncidentes]);

  return { incidentes, loading, error, cargarIncidentes };
}