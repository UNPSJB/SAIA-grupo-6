import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarInsumosQuimicos } from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

/**
 * Página actual de insumos químicos, pedida al backend (server-side).
 * El selector del checklist usa `listarOpcionesInsumosQuimicos`, que sigue
 * devolviendo la lista liviana completa.
 */
export function useInsumosQuimicos(verInactivos = false, pageSize = 10) {
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarInsumosQuimicos(page, pageSize, verInactivos),
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
  } = useListaPaginada<InsumoQuimico>({
    cargar,
    dependencias: [verInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos químicos",
    pageSize,
  });

  return {
    insumos: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarInsumos: recargar,
  };
}
