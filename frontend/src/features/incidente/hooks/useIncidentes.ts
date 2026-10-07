import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarIncidentes } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Carga el listado de incidentes.
 * @param estado Filtro por estado; "" o undefined trae todos.
 */
export function useIncidentes(estado: EstadoIncidente | "" = "") {
  const cargarIncidentes = useCallback(() => listarIncidentes(estado), [estado]);

  const { items, loading, error, recargar } = useLista<Incidente[]>({
    cargar: cargarIncidentes,
    dependencias: [estado],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los incidentes",
  });

  return { incidentes: items, loading, error, cargarIncidentes: recargar };
}