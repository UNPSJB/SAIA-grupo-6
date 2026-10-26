import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarEquiposPaginados } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

/**
 * Página actual de equipos, pedida al backend (paginación server-side).
 *
 * La tabla de gestión usa este hook; los dropdowns (formularios, filtros) y
 * el tablero siguen usando `useEquipos`, que necesita la lista completa.
 */
export function useEquiposPaginados(verInactivos = false, pageSize = 10) {
  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarEquiposPaginados(page, pageSize, verInactivos),
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
  } = useListaPaginada<Equipo>({
    cargar,
    dependencias: [verInactivos],
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
