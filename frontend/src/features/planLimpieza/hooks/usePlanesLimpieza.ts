import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarPlanesLimpieza } from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

/**
 * Página actual de planes de limpieza, pedida al backend (server-side).
 */
export function usePlanesLimpieza(verInactivos = false, pageSize = 10) {
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarPlanesLimpieza(page, pageSize, verInactivos),
    [verInactivos]
  );

  const {
    items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    recargar,
  } = useListaPaginada<PlanLimpieza>({
    cargar,
    dependencias: [verInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los planes de limpieza",
    pageSize,
  });

  return {
    planes: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarPlanes: recargar,
  };
}
