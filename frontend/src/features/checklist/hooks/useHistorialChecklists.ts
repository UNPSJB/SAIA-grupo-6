import { useState, useEffect, useCallback } from "react";
import { obtenerHistorialChecklists } from "../services/checklistService";
import type { HistorialChecklistResponse } from "../types/checklist";

export function useHistorialChecklists(
  fechaDesde: string,
  fechaHasta: string,
  equipoId?: number
) {
  const [historial, setHistorial] = useState<HistorialChecklistResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarHistorial = useCallback(async () => {
    if (fechaDesde > fechaHasta) {
      setError("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
      setHistorial(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const datos = await obtenerHistorialChecklists(fechaDesde, fechaHasta, equipoId);
      setHistorial(datos);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar el historial de checklists"
      );
      setHistorial(null);
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, equipoId]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  return {
    historial,
    loading,
    error,
    recargar: cargarHistorial,
  };
}