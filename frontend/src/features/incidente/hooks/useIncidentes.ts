import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { listarIncidentesPaginados } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Página actual de incidentes, pedida al backend con todos los filtros
 * (estado, tipo, búsqueda) aplicados en el servidor.
 *
 * `orden="antiguos"` deja primero los que llevan más tiempo sin resolverse,
 * que es como la tabla de gestión los muestra siempre.
 *
 * La búsqueda llega con debounce (300 ms tras la última tecla): sin eso, el
 * hook pedía una página al servidor por cada tecla. El reseteo a la página 1
 * cuando cambia un filtro lo hace `useListaPaginada`.
 */
export function useIncidentes(
  estado: EstadoIncidente | "" = "",
  tipo = "",
  buscar = "",
  pageSize = 10
) {
  const buscarAplicado = useValorDebounced(buscar);

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarIncidentesPaginados(page, pageSize, {
        estado,
        tipo,
        buscar: buscarAplicado,
        orden: "antiguos",
      }),
    [estado, tipo, buscarAplicado]
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
  } = useListaPaginada<Incidente>({
    cargar,
    dependencias: [estado, tipo, buscarAplicado],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los incidentes",
    pageSize,
  });

  return {
    incidentes: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarIncidentes: recargar,
  };
}
