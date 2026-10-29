import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarPlanesCalibracionMantenimientoPaginados,
  type FiltrosPlanesCalibracion,
} from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

/**
 * Página actual de planes, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; las pantallas de equipo siguen usando
 * `usePlanesCalibracionMantenimiento` (lista completa de un solo pedido).
 */
export function usePlanesCalibracionMantenimientoPaginados(
  filtros: FiltrosPlanesCalibracion = {},
  pageSize = 10
) {
  const {
    incluirInactivos = false,
    buscar,
    tipo,
    equipoId,
    orden = "equipo_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarPlanesCalibracionMantenimientoPaginados(page, pageSize, {
        incluirInactivos,
        buscar,
        tipo,
        equipoId,
        orden,
      }),
    [incluirInactivos, buscar, tipo, equipoId, orden]
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
    dependencias: [incluirInactivos, buscar, tipo, equipoId, orden],
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
