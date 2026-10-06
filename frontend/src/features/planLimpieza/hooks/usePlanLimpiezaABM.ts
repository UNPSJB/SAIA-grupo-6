import { useABM } from "../../../common/hooks/useABM";
import {
    crearPlanLimpieza,
    modificarPlanLimpieza,
    eliminarPlanLimpieza,
    reactivarPlanLimpieza,
    type PlanLimpiezaInput,
} from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

export function usePlanLimpiezaABM() {
    return useABM<PlanLimpiezaInput, PlanLimpieza>({
        crear: crearPlanLimpieza,
        modificar: modificarPlanLimpieza,
        eliminar: eliminarPlanLimpieza,
        reactivar: reactivarPlanLimpieza,
        etiqueta: "el plan de limpieza",
    });
}