import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerHistorialIncidente } from "../services/incidenteService";
import type { HistorialIncidenteResponse } from "../types/incidente";

/** Cierres y reaperturas de un incidente, del más viejo al más nuevo. */
export function useHistorialIncidente(id: number) {
  const { registro, loading, error } = useRegistro<HistorialIncidenteResponse>({
    cargar: obtenerHistorialIncidente,
    id,
    etiqueta: "el historial",
  });

  return { historial: registro?.eventos ?? [], loading, error };
}
