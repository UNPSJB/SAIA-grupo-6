import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { listarIncidentesPaginados } from "../services/incidenteService";
import type { Incidente, EstadoIncidente } from "../types/incidente";

/**
 * Página actual de incidentes, pedida al backend con todos los filtros
 * aplicados en el servidor: estado, tipo, búsqueda, rango de fechas y orden.
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
  fechaDesde?: string,
  fechaHasta?: string,
  pageSize = 10,
  orden: "antiguos" | "recientes" = "antiguos"
) {
  const buscarAplicado = useValorDebounced(buscar);

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarIncidentesPaginados(page, pageSize, {
        estado,
        tipo,
        buscar: buscarAplicado,
        fechaDesde,
        fechaHasta,
        orden,
      }),
    [estado, tipo, buscarAplicado, fechaDesde, fechaHasta, orden]
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
    dependencias: [estado, tipo, buscarAplicado, fechaDesde, fechaHasta, orden],
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
