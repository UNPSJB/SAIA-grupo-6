import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarInsumos } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumos(incluirInactivos = false) {
    const cargarInsumos = useCallback(() => listarInsumos(incluirInactivos), [incluirInactivos]);

    const { items, loading, error, recargar } = useLista<Insumo[]>({
        cargar: cargarInsumos,
        dependencias: [incluirInactivos],
        valorInicial: [],
        mensajeError: "No se pudieron cargar los insumos",
    });

    return {
        insumos: items,
        loading,
        error,
        cargarInsumos: recargar,
    };
}