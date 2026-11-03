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
        soloInactivos = false,
        buscar,
        rol,
        orden = "nombre_asc",
    } = filtros;

    const cargar = useCallback(
        (page: number, pageSize: number) =>
            listarPersonal(page, pageSize, {
                soloInactivos,
                buscar,
                rol,
                orden,
            }),
        [soloInactivos, buscar, rol, orden]
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
        dependencias: [soloInactivos, buscar, rol, orden],
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
