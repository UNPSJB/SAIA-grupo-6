import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarUnidadesMedidaPaginadas,
  type FiltrosUnidadesMedida,
} from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

/**
 * Página actual de unidades de medida, pedida al backend (server-side).
 * Los dropdowns de formularios siguen usando `listarUnidadesMedida` (la lista
 * completa) directo del service.
 */
export function useUnidadesMedida(
  filtros: FiltrosUnidadesMedida = {},
  pageSize = 10
) {
  const {
    soloInactivos = false,
    buscar,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarUnidadesMedidaPaginadas(page, pageSize, {
        soloInactivos,
        buscar,
        orden,
      }),
    [soloInactivos, buscar, orden]
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
  } = useListaPaginada<UnidadMedida>({
    cargar,
    dependencias: [soloInactivos, buscar, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las unidades de medida",
    pageSize,
  });

  return {
    unidades: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarUnidades: recargar,
  };
}
