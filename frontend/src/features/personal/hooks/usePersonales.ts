import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarPersonal } from "../services/personalService";
import type { Persona } from "../types/personal";

export function usePersonales(incluirInactivos = false) {
    const cargarPersonales = useCallback(() => listarPersonal(incluirInactivos), [incluirInactivos]);

    const { items, loading, error, recargar } = useLista<Persona[]>({
        cargar: cargarPersonales,
        dependencias: [incluirInactivos],
        valorInicial: [],
        mensajeError: "No se pudo cargar el personal",
    });

    return {
        personales: items,
        loading,
        error,
        cargarPersonales: recargar,
    };
}