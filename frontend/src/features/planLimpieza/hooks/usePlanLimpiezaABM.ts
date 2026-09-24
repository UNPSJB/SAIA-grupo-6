import { useState } from "react";
import {
    crearPlanLimpieza,
    modificarPlanLimpieza,
    eliminarPlanLimpieza,
    type PlanLimpiezaInput,
} from "../services/planLimpiezaService";

export function usePlanLimpiezaABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const alta = async (plan: PlanLimpiezaInput) => {
        try {
            setLoading(true);
            setError(null);
            return await crearPlanLimpieza(plan);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear el plan de limpieza");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const modificar = async (id: number, plan: PlanLimpiezaInput) => {
        try {
            setLoading(true);
            setError(null);
            return await modificarPlanLimpieza(id, plan);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo modificar el plan de limpieza");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const borrar = async (id: number) => {
        try {
            setLoading(true);
            setError(null);
            await eliminarPlanLimpieza(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar el plan de limpieza");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { alta, modificar, borrar, loading, error };
}
