import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarIngredientes, type FiltrosIngredientes } from "../services/ingredienteService";
import type { Ingrediente } from "../types/ingrediente";

/**
 * Página actual de ingredientes, pedida al backend (paginación server-side).
 *
 * `cargarIngredientes` re-pide la página actual: es lo que las páginas llaman
 * después de una baja/reactivación para refrescar la tabla.
 */
export function useIngredientes(filtros: FiltrosIngredientes = {}, pageSize = 10) {
    const {
        soloInactivos = false,
        buscar,
        unidadMedidaId,
        esAditivo,
        proveedorId,
        orden = "nombre_asc",
    } = filtros;

    const cargar = useCallback(
        (page: number, tamanoPagina: number) =>
            listarIngredientes(page, tamanoPagina, {
                soloInactivos,
                buscar,
                unidadMedidaId,
                esAditivo,
                proveedorId,
                orden,
            }),
        [soloInactivos, buscar, unidadMedidaId, esAditivo, proveedorId, orden]
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
    } = useListaPaginada<Ingrediente>({
        cargar,
        dependencias: [soloInactivos, buscar, unidadMedidaId, esAditivo, proveedorId, orden],
        valorInicial: [],
        mensajeError: "No se pudieron cargar los ingredientes",
        pageSize,
    });

    return {
        ingredientes: items,
        total,
        page,
        setPage,
        hayVariasPaginas,
        loading,
        error,
        cargarIngredientes: recargar,
    };
}