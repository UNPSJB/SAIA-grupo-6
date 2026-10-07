import { useState } from "react";
import { crearIncidente, cambiarEstadoIncidente } from "../services/incidenteService";
import type { IncidenteFormValues } from "../types/incidente";

export function useIncidenteABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alta = async (
    datos: IncidenteFormValues,
    foto?: File
  ) => {
    try {
      setLoading(true);
      setError(null);
      return await crearIncidente(datos, foto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /** Cierra el incidente dejando la acción correctiva que se realizó. */
  const cerrar = async (id: number, observacionCierre?: string) => {
    try {
      setLoading(true);
      setError(null);
      return await cambiarEstadoIncidente(id, "cerrado", observacionCierre);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /** Reabre un incidente cerrado y limpia los datos de la resolución. */
  const reabrir = async (id: number, motivo?: string) => {
    try {
      setLoading(true);
      setError(null);
      return await cambiarEstadoIncidente(id, "abierto", motivo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reabrir el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { alta, cerrar, reabrir, loading, error };
}