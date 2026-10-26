import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarMisIncidentesPaginados } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

/**
 * Página actual de los incidentes del operador, pedida al backend
 * (paginación server-side).
 */
export function useMisIncidentes(pageSize = 10) {
  const cargar = useCallback(
    (page: number, pageSize: number) => listarMisIncidentesPaginados(page, pageSize),
    []
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
    dependencias: [],
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
