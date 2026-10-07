import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerPlanCalibracionMantenimiento } from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

export function usePlanCalibracionMantenimiento(id: number | null) {
  const { registro, loading, error } = useRegistro<PlanCalibracionMantenimiento>({
    cargar: obtenerPlanCalibracionMantenimiento,
    id,
    etiqueta: "el plan de calibración y mantenimiento",
  });

  return { plan: registro, loading, error };
}