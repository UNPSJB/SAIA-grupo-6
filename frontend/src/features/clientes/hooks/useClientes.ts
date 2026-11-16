import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import { listarClientesPaginados } from "../services/clienteService";
import type { OrdenCliente } from "../services/clienteService";
import type { Cliente } from "../types/cliente";

const PAGE_SIZE = 10;

const ETIQUETAS_ORDEN: Record<string, string> = {
  nombre: "Nombre",
  documento: "Documento",
  telefono: "Teléfono",
};

/**
 * Página actual de clientes, pedida al backend con todos los filtros
 * aplicados en el servidor: búsqueda y orden.
 *
 * La búsqueda llega con debounce (300 ms tras la última tecla): sin eso, el
 * hook pedía una página al servidor por cada tecla. El reseteo a la página 1
 * cuando cambia un filtro lo hace `useListaPaginada`.
 */
export function useClientes(
  incluirInactivos = false,
  buscar = "",
  orden: OrdenCliente = "nombre_asc"
) {
  const buscarAplicado = useValorDebounced(buscar);

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarClientesPaginados(page, pageSize, {
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
  } = useListaPaginada<Cliente>({
    cargar,
    dependencias: [incluirInactivos, buscarAplicado, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los clientes",
    pageSize: PAGE_SIZE,
  });

  return {
    clientes: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarClientes: recargar,
    PAGE_SIZE,
    ETIQUETAS_ORDEN,
  };
}
