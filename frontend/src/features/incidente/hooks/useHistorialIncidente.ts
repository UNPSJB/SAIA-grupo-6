import { useState } from "react";
import { obtenerHistorialIncidente } from "../services/incidenteService";
import type { HistorialIncidenteItem } from "../types/incidente";

export function useHistorialIncidente() {
  const [historial, setHistorial] = useState<HistorialIncidenteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarHistorial = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerHistorialIncidente(id);
      setHistorial(data.eventos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  const limpiarHistorial = () => {
    setHistorial(null);
    setError(null);
  };

  return { historial, loading, error, cargarHistorial, limpiarHistorial };
}
