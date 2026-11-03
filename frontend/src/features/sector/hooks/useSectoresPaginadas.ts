import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarSectoresPaginados,
  type FiltrosSectores,
} from "../services/sectorService";
import type { Sector } from "../types/sector";

/**
 * Página actual de sectores, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; los dropdowns de formularios siguen
 * usando `useSectores`, que necesita la lista completa de una vez.
 */
export function useSectoresPaginadas(
  filtros: FiltrosSectores = {},
  pageSize = 10
) {
  const {
    soloInactivos = false,
    buscar,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarSectoresPaginados(page, pageSize, {
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
  } = useListaPaginada<Sector>({
    cargar,
    dependencias: [soloInactivos, buscar, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los sectores",
    pageSize,
  });

  return {
    sectores: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarSectores: recargar,
  };
}
