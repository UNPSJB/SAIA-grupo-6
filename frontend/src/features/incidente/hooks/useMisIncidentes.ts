import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarMisIncidentesPaginados } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Página actual de los incidentes del operador, pedida al backend
 * (paginación server-side).
 *
 * El orden es fijo ("más recientes primero"); el único filtro es el estado,
 * que se aplica en el servidor. Al cambiarlo, `useListaPaginada` vuelve solo
 * a la página 1.
 */
export function useMisIncidentes(
  pageSize = 10,
  estado: EstadoIncidente | "" = ""
) {
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarMisIncidentesPaginados(page, pageSize, estado),
    [estado]
  );

  const {
    items,
    total,
    page,
    setPage,
    primeraPagina,
    hayVariasPaginas,
    loading,
    error,
    recargar,
  } = useListaPaginada<Incidente>({
    cargar,
    dependencias: [estado],
    valorInicial: [],
    mensajeError: "No se pudieron cargar tus incidentes",
    pageSize,
  });

  return {
    misIncidentes: items,
    total,
    page,
    setPage,
    primeraPagina,
    hayVariasPaginas,
    loading,
    error,
    cargarMisIncidentes: recargar,
  };
}
