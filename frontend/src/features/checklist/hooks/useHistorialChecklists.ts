import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerHistorialChecklists } from "../services/checklistService";
import type { HistorialChecklistResponse } from "../types/checklist";

export function useHistorialChecklists(
  fechaDesde: string,
  fechaHasta: string,
  equipoId?: number
) {
  const cargarHistorial = useCallback(() => {
    // El backend no valida el rango, así que se avisa acá y no se gasta un
    // request en un 422 que igual se iba a mostrar como error.
    if (fechaDesde > fechaHasta) {
      throw new Error("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
    }

    return obtenerHistorialChecklists(fechaDesde, fechaHasta, equipoId);
  }, [fechaDesde, fechaHasta, equipoId]);

  const { items, loading, error, recargar } = useLista<HistorialChecklistResponse | null>({
    cargar: cargarHistorial,
    dependencias: [fechaDesde, fechaHasta, equipoId],
    valorInicial: null,
    mensajeError: "Error al cargar el historial de checklists",
    preferirMensajeDelBackend: true,
    vaciarAlFallar: true,
  });

  return {
    historial: items,
    loading,
    error,
    recargar,
  };
}