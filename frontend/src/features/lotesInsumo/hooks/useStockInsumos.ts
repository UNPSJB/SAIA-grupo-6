import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarInsumosActivos,
  listarLotesSugeridos,
  listarStockInsumos,
  listarStockLotes,
} from "../services/loteInsumoService";
import type { InsumoOpcion, StockInsumo, StockLoteInsumo } from "../types/loteInsumo";

export function useStockInsumos() {
  const cargar = useCallback(() => listarStockInsumos(), []);
  const { items, loading, error, recargar } = useLista<StockInsumo[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudo cargar el stock de insumos",
  });
  return { stock: items, loading, error, recargar };
}

export function useStockLotes(insumoId: number | undefined, incluirInactivos: boolean) {
  const cargar = useCallback(
    () => listarStockLotes(insumoId, incluirInactivos),
    [insumoId, incluirInactivos],
  );
  const { items, loading, error, recargar } = useLista<StockLoteInsumo[]>({
    cargar,
    dependencias: [insumoId, incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes de insumo",
  });
  return { lotes: items, loading, error, recargar };
}

export function useLotesSugeridos(insumoId: number | null) {
  const cargar = useCallback(
    () => (insumoId ? listarLotesSugeridos(insumoId) : Promise.resolve([])),
    [insumoId],
  );
  const { items, loading, error } = useLista<StockLoteInsumo[]>({
    cargar,
    dependencias: [insumoId],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes sugeridos",
  });
  return { lotes: items, loading, error };
}

export function useInsumosActivos() {
  const cargar = useCallback(() => listarInsumosActivos(), []);
  const { items, loading, error } = useLista<InsumoOpcion[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos",
  });
  return { insumos: items, loading, error };
}
