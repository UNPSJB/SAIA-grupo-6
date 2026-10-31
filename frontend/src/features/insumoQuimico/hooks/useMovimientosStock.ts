import { useCallback } from "react";

import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarMovimientosStockPaginados } from "../services/stockService";
import type { FiltrosMovimientosStock, MovimientoStock } from "../types/stock";

export function useMovimientosStock(
  filtros: Omit<FiltrosMovimientosStock, "limit" | "offset">,
) {
  const { insumo_quimico_id, fecha_desde, fecha_hasta, tipo } = filtros;
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarMovimientosStockPaginados(page, pageSize, {
        insumo_quimico_id,
        fecha_desde,
        fecha_hasta,
        tipo,
      }),
    [insumo_quimico_id, fecha_desde, fecha_hasta, tipo],
  );
  const listado = useListaPaginada<MovimientoStock>({
    cargar,
    dependencias: [insumo_quimico_id, fecha_desde, fecha_hasta, tipo],
    valorInicial: [],
    mensajeError: "No se pudieron obtener los movimientos",
  });
  return { movimientos: listado.items, ...listado };
}
