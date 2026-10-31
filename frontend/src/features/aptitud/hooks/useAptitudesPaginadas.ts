import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarAptitudesPaginadas,
  type FiltrosAptitudes,
} from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

/**
 * Página actual de aptitudes, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; los dropdowns de formularios siguen
 * usando `useAptitudes`, que necesita la lista completa de una vez.
 */
export function useAptitudesPaginadas(
  filtros: FiltrosAptitudes = {},
  pageSize = 10
) {
  const {
    incluirInactivos = false,
    buscar,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarAptitudesPaginadas(page, pageSize, {
        incluirInactivos,
        buscar,
        orden,
      }),
    [incluirInactivos, buscar, orden]
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
  } = useListaPaginada<Aptitud>({
    cargar,
    dependencias: [incluirInactivos, buscar, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las aptitudes",
    pageSize,
  });

  return {
    aptitudes: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarAptitudes: recargar,
  };
}
