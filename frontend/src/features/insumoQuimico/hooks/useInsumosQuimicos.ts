import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarInsumosQuimicos,
  type FiltrosInsumosQuimicos,
} from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

/**
 * Página actual de insumos químicos, pedida al backend (server-side).
 * El selector del checklist usa `listarOpcionesInsumosQuimicos`, que sigue
 * devolviendo la lista liviana completa.
 */
export function useInsumosQuimicos(
  filtros: FiltrosInsumosQuimicos = {},
  pageSize = 10
) {
  const {
    soloInactivos = false,
    buscar,
    tipo,
    unidadMedidaId,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarInsumosQuimicos(page, pageSize, {
        soloInactivos,
        buscar,
        tipo,
        unidadMedidaId,
        orden,
      }),
    [soloInactivos, buscar, tipo, unidadMedidaId, orden]
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
    dependencias: [soloInactivos, buscar, tipo, unidadMedidaId, orden],
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
