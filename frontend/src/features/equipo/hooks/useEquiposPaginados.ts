import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarEquiposPaginados,
  type FiltrosEquipos,
} from "../services/equipoService";
import type { Equipo } from "../types/equipo";

/**
 * Página actual de equipos, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; los dropdowns (formularios, filtros) y
 * el tablero siguen usando `useEquipos`, que necesita la lista completa.
 */
export function useEquiposPaginados(
  filtros: FiltrosEquipos = {},
  pageSize = 10
) {
  const {
    incluirInactivos = false,
    buscar,
    tipo,
    sectorId,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, tamanoPagina: number) =>
      listarEquiposPaginados(page, tamanoPagina, {
        incluirInactivos,
        buscar,
        tipo,
        sectorId,
        orden,
      }),
    [incluirInactivos, buscar, tipo, sectorId, orden]
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
  } = useListaPaginada<Equipo>({
    cargar,
    dependencias: [incluirInactivos, buscar, tipo, sectorId, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los equipos",
    pageSize,
  });

  return {
    equipos: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarEquipos: recargar,
  };
}
