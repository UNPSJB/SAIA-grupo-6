import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarEquipos } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipos(incluirInactivos = false) {
    const cargarEquipos = useCallback(() => listarEquipos(incluirInactivos), [incluirInactivos]);

    const { items, loading, error, recargar } = useLista<Equipo[]>({
        cargar: cargarEquipos,
        dependencias: [incluirInactivos],
        valorInicial: [],
        mensajeError: "No se pudieron cargar los equipos",
    });

    return {
        equipos: items,
        loading,
        error,
        cargarEquipos: recargar,
    };
}