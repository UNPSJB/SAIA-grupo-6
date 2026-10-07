import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarMisIncidentes } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

export function useMisIncidentes() {
  const cargarMisIncidentes = useCallback(() => listarMisIncidentes(), []);

  const { items, loading, error, recargar } = useLista<Incidente[]>({
    cargar: cargarMisIncidentes,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar tus incidentes",
  });

  return { misIncidentes: items, loading, error, cargarMisIncidentes: recargar };
}