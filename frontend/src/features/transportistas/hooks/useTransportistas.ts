import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { listarTransportistasPaginados } from "../services/transportistaService";
import type { OrdenTransportista } from "../services/transportistaService";
import type { Transportista } from "../types/transportista";

const PAGE_SIZE = 10;

const ETIQUETAS_ORDEN: Record<string, string> = {
  razon_social: "Razón Social",
  cuit: "CUIT",
};

/**
 * Página actual de transportistas, pedida al backend con todos los filtros
 * aplicados en el servidor: búsqueda y orden.
 *
 * La búsqueda llega con debounce (300 ms tras la última tecla): sin eso, el
 * hook pedía una página al servidor por cada tecla. El reseteo a la página 1
 * cuando cambia un filtro lo hace `useListaPaginada`.
 */
export function useTransportistas(
  incluirInactivos = false,
  buscar = "",
  orden: OrdenTransportista = "razon_social_asc"
) {
  const buscarAplicado = useValorDebounced(buscar);

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarTransportistasPaginados(page, pageSize, {
        incluirInactivos,
        buscar: buscarAplicado,
        orden,
      }),
    [incluirInactivos, buscarAplicado, orden]
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
  } = useListaPaginada<Transportista>({
    cargar,
    dependencias: [incluirInactivos, buscarAplicado, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los transportistas",
    pageSize: PAGE_SIZE,
  });

  return {
    transportistas: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarTransportistas: recargar,
    PAGE_SIZE,
    ETIQUETAS_ORDEN,
  };
}
