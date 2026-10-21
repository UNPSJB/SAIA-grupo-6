import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarIncidentes } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Carga el listado de incidentes.
 * @param estado Filtro por estado; "" o undefined trae todos.
 * @param fechaDesde / fechaHasta Acotan por fecha de reporte (inclusive);
 *        se omiten cuando se quiere el histórico completo.
 */
export function useIncidentes(
  estado: EstadoIncidente | "" = "",
  fechaDesde?: string,
  fechaHasta?: string
) {
  const cargarIncidentes = useCallback(
    () => listarIncidentes(estado, undefined, undefined, fechaDesde, fechaHasta),
    [estado, fechaDesde, fechaHasta]
  );

  const { items, loading, error, recargar } = useLista<Incidente[]>({
    cargar: cargarIncidentes,
    dependencias: [estado, fechaDesde, fechaHasta],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los incidentes",
  });

  return { incidentes: items, loading, error, cargarIncidentes: recargar };
}