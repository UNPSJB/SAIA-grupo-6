import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
    listarPersonal,
    type FiltrosPersonal,
} from "../services/personalService";
import type { Persona } from "../types/personal";

/**
 * Página actual de personal.
 */
export function usePersonales(
    filtros: FiltrosPersonal = {},
    pageSize = 10
) {
    const {
        incluirInactivos = false,
        buscar,
        rol,
        orden = "nombre_asc",
    } = filtros;

    const cargar = useCallback(
        (page: number, pageSize: number) =>
            listarPersonal(page, pageSize, {
                incluirInactivos,
                buscar,
                rol,
                orden,
            }),
        [incluirInactivos, buscar, rol, orden]
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
        dependencias: [incluirInactivos, buscar, rol, orden],
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
