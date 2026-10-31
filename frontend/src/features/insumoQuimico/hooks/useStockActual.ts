import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarStockActual } from "../services/stockService";
import type { FiltrosStockActual, StockInsumoQuimico } from "../types/stock";

export function useStockActual(filtros: FiltrosStockActual) {
  const { buscar, stockBajo, orden = "nombre_asc" } = filtros;
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarStockActual(page, pageSize, { buscar, stockBajo, orden }),
    [buscar, stockBajo, orden],
  );
  const listado = useListaPaginada<StockInsumoQuimico>({
    cargar,
    dependencias: [buscar, stockBajo, orden],
    valorInicial: [],
    mensajeError: "No se pudo obtener el stock actual",
  });
  return { stock: listado.items, ...listado };
}
