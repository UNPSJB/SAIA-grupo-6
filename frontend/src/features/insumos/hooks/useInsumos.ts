import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarInsumos } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

/**
 * Página actual de insumos, pedida al backend (paginación server-side).
 *
 * `cargarInsumos` re-pide la página actual: es lo que las páginas llaman
 * después de una baja/reactivación para refrescar la tabla.
 */
export function useInsumos(verInactivos = false, pageSize = 10) {
    const cargar = useCallback(
        (page: number, pageSize: number) =>
            listarInsumos(page, pageSize, verInactivos),
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
    } = useListaPaginada<Insumo>({
        cargar,
        dependencias: [verInactivos],
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
