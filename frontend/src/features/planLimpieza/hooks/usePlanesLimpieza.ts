import { useCallback, useEffect, useState } from "react";
import { listarPlanesLimpieza } from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

export function usePlanesLimpieza() {
    const [planes, setPlanes] = useState<PlanLimpieza[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarPlanes = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listarPlanesLimpieza();
            setPlanes(data);
        } catch (err) {
            setError("No se pudieron cargar los planes de limpieza");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarPlanes();
    }, [cargarPlanes]);

    return { planes, loading, error, cargarPlanes };
}
