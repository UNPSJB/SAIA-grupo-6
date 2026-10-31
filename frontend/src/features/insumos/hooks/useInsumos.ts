import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarInsumos, type FiltrosInsumos } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

/**
 * Página actual de insumos, pedida al backend (paginación server-side).
 *
 * `cargarInsumos` re-pide la página actual: es lo que las páginas llaman
 * después de una baja/reactivación para refrescar la tabla.
 */
export function useInsumos(filtros: FiltrosInsumos = {}, pageSize = 10) {
    const {
        incluirInactivos = false,
        buscar,
        unidadMedidaId,
        orden = "nombre_asc",
    } = filtros;

    const cargar = useCallback(
        (page: number, tamanoPagina: number) =>
            listarInsumos(page, tamanoPagina, {
                incluirInactivos,
                buscar,
                unidadMedidaId,
                orden,
            }),
        [incluirInactivos, buscar, unidadMedidaId, orden]
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
    } = useListaPaginada<Insumo>({
        cargar,
        dependencias: [incluirInactivos, buscar, unidadMedidaId, orden],
        valorInicial: [],
        mensajeError: "No se pudieron cargar los insumos",
        pageSize,
    });

    return {
        insumos: items,
        total,
        page,
        setPage,
        hayVariasPaginas,
        loading,
        error,
        cargarInsumos: recargar,
    };
}
