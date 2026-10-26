import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarPersonal } from "../services/personalService";
import type { Persona } from "../types/personal";

/**
 * Página actual de personal, pedida al backend (paginación server-side).
 */
export function usePersonales(verInactivos = false, pageSize = 10) {
    const cargar = useCallback(
        (page: number, pageSize: number) =>
            listarPersonal(page, pageSize, verInactivos),
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
    } = useListaPaginada<Persona>({
        cargar,
        dependencias: [verInactivos],
        valorInicial: [],
        mensajeError: "No se pudo cargar el personal",
        pageSize,
    });

    return {
        personales: items,
        total,
        page,
        setPage,
        hayVariasPaginas,
        loading,
        error,
        cargarPersonales: recargar,
    };
}
