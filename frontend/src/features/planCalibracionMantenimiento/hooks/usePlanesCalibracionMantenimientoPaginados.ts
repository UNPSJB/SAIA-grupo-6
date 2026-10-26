import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarPlanesCalibracionMantenimientoPaginados } from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

/**
 * Página actual de planes, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; las pantallas de equipo siguen usando
 * `usePlanesCalibracionMantenimiento` (lista completa de un solo pedido).
 */
export function usePlanesCalibracionMantenimientoPaginados(
  verInactivos = false,
  pageSize = 10
) {
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarPlanesCalibracionMantenimientoPaginados(page, pageSize, verInactivos),
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
  } = useListaPaginada<PlanCalibracionMantenimiento>({
    cargar,
    dependencias: [verInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los planes de calibración y mantenimiento",
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
