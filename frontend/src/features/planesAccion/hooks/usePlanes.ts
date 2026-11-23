import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { listarPlanes, type FiltrosPlanes } from "../services/planAccionService";
import type { PlanResumen } from "../types/planAccion";

/**
 * Página de planes de acción, con los filtros aplicados en el servidor. La
 * búsqueda llega con debounce, igual que en el resto de los listados.
 */
export function usePlanes(filtros: FiltrosPlanes, pageSize = 10) {
  const buscar = useValorDebounced(filtros.buscar ?? "");
  const { grupo, estado, tipo, vencidos } = filtros;

  const cargar = useCallback(
    (page: number, size: number) =>
      listarPlanes(page, size, { grupo, estado, tipo, vencidos, buscar }),
    [grupo, estado, tipo, vencidos, buscar],
  );

  const { items, total, page, setPage, hayVariasPaginas, loading, error, recargar } =
    useListaPaginada<PlanResumen>({
      cargar,
      dependencias: [grupo, estado, tipo, vencidos, buscar],
      valorInicial: [],
      mensajeError: "No se pudieron cargar los planes de acción",
      pageSize,
    });

  return { planes: items, total, page, setPage, hayVariasPaginas, loading, error, recargar };
}
