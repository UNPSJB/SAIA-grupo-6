import { useEffect, useState } from "react";
import { obtenerPlanLimpieza } from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

export function usePlanLimpieza(id: number | null) {
    const [plan, setPlan] = useState<PlanLimpieza | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id === null) return;

        const cargarPlan = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await obtenerPlanLimpieza(id);
                setPlan(data);
            } catch (err) {
                setError("No se pudo cargar el plan de limpieza");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        cargarPlan();
    }, [id]);

    return { plan, loading, error };
}
