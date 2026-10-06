import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerPlanLimpieza } from "../services/planLimpiezaService";
import type { PlanLimpieza } from "../types/planLimpieza";

export function usePlanLimpieza(id: number | null) {
  const { registro, loading, error } = useRegistro<PlanLimpieza>({
    cargar: obtenerPlanLimpieza,
    id,
    etiqueta: "el plan de limpieza",
  });

  return { plan: registro, loading, error };
}