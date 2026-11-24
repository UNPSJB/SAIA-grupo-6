import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarIngredientesActivos,
  listarLotesSugeridos,
  listarStockInsumos,
  listarStockLotes,
} from "../services/loteInsumoService";
import type { IngredienteOpcion, StockIngrediente, StockLoteInsumo } from "../types/loteInsumo";

export function useStockInsumos() {
  const cargar = useCallback(() => listarStockInsumos(), []);
  const { items, loading, error, recargar } = useLista<StockIngrediente[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudo cargar el stock de insumos",
  });
  return { stock: items, loading, error, recargar };
}

export function useStockLotes(ingredienteId: number | undefined, incluirInactivos: boolean) {
  const cargar = useCallback(
    () => listarStockLotes(ingredienteId, incluirInactivos),
    [ingredienteId, incluirInactivos],
  );
  const { items, loading, error, recargar } = useLista<StockLoteInsumo[]>({
    cargar,
    dependencias: [ingredienteId, incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes de insumo",
  });
  return { lotes: items, loading, error, recargar };
}

export function useLotesSugeridos(ingredienteId: number | null) {
  const cargar = useCallback(
    () => (ingredienteId ? listarLotesSugeridos(ingredienteId) : Promise.resolve([])),
    [ingredienteId],
  );
  const { items, loading, error, recargar } = useLista<StockLoteInsumo[]>({
    cargar,
    dependencias: [ingredienteId],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes sugeridos",
  });
  return { lotes: items, loading, error, recargar };
}

export function useIngredientesActivos() {
  const cargar = useCallback(() => listarIngredientesActivos(), []);
  const { items, loading, error } = useLista<IngredienteOpcion[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los ingredientes",
  });
  return { ingredientes: items, loading, error };
}
