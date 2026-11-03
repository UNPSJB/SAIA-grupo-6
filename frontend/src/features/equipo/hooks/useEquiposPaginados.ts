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
    soloInactivos = false,
    buscar,
    tipo,
    sectorId,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, tamanoPagina: number) =>
      listarEquiposPaginados(page, tamanoPagina, {
        soloInactivos,
        buscar,
        tipo,
        sectorId,
        orden,
      }),
    [soloInactivos, buscar, tipo, sectorId, orden]
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
    dependencias: [soloInactivos, buscar, tipo, sectorId, orden],
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
