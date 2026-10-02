import { useState } from "react";
import { crearIncidente, eliminarIncidente } from "../services/incidenteService";
import type { Incidente, IncidenteFormValues } from "../types/incidente";

export function useIncidenteABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alta = async (
    datos: IncidenteFormValues,
    usuarioId: number,
    foto?: File
  ) => {
    try {
      setLoading(true);
      setError(null);
      return await crearIncidente(datos, usuarioId, foto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await eliminarIncidente(id);
    } catch (err) {
      setError("No se pudo eliminar el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { alta, borrar, loading, error };
}
