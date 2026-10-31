import { useCallback } from "react";

import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarLotesStockPaginados } from "../services/stockService";
import type { FiltrosLotesStock, LoteStock } from "../types/stock";

export function useLotesStock(
  filtros: Omit<FiltrosLotesStock, "limit" | "offset">,
) {
  const { proveedor_id, insumo_quimico_id, numero_lote } = filtros;
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarLotesStockPaginados(page, pageSize, {
        proveedor_id,
        insumo_quimico_id,
        numero_lote,
      }),
    [proveedor_id, insumo_quimico_id, numero_lote],
  );
  const listado = useListaPaginada<LoteStock>({
    cargar,
    dependencias: [proveedor_id, insumo_quimico_id, numero_lote],
    valorInicial: [],
    mensajeError: "No se pudieron obtener los lotes",
  });
  return { lotes: listado.items, ...listado };
}
