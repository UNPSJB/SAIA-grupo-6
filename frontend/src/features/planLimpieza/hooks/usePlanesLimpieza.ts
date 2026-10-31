import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarPlanesLimpieza,
  type FiltrosPlanesLimpieza,
} from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

/** Página actual de planes de limpieza. */
export function usePlanesLimpieza(
  filtros: FiltrosPlanesLimpieza = {},
  pageSize = 10
) {
  const {
    incluirInactivos = false,
    buscar,
    equipoId,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarPlanesLimpieza(page, pageSize, {
        incluirInactivos,
        buscar,
        equipoId,
        orden,
      }),
    [incluirInactivos, buscar, equipoId, orden]
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
    dependencias: [incluirInactivos, buscar, equipoId, orden],
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
