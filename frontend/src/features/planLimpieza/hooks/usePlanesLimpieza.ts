import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarPlanesLimpieza } from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

export function usePlanesLimpieza(incluirInactivos = false) {
    const cargarPlanes = useCallback(() => listarPlanesLimpieza(incluirInactivos), [incluirInactivos]);

    const { items, loading, error, recargar } = useLista<PlanLimpieza[]>({
        cargar: cargarPlanes,
        dependencias: [incluirInactivos],
        valorInicial: [],
        mensajeError: "No se pudieron cargar los planes de limpieza",
    });

    return { planes: items, loading, error, cargarPlanes: recargar };
}