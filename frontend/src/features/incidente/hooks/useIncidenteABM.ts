import { useState } from "react";
import { crearIncidente, cambiarEstadoIncidente } from "../services/incidenteService";
import { useNotificacionesListener } from "../../notificaciones/hooks/useNotificacionesListener";
import type { IncidenteFormValues } from "../types/incidente";

export function useIncidenteABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cualquier cambio en incidentes afecta las notificaciones (incidentes abiertos
  // son alertas en el dashboard y la campana): refrescamos tras cada mutación.
  const { notificarCambio } = useNotificacionesListener();

  const alta = async (
    datos: IncidenteFormValues,
    foto?: File
  ) => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await crearIncidente(datos, foto);
      notificarCambio();
      return resultado;
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
      const resultado = await cambiarEstadoIncidente(id, "cerrado", observacionCierre);
      notificarCambio();
      return resultado;
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
      const resultado = await cambiarEstadoIncidente(id, "abierto", motivo);
      notificarCambio();
      return resultado;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reabrir el incidente");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { alta, cerrar, reabrir, loading, error };
}