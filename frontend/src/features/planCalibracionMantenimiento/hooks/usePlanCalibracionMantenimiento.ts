import { useEffect, useState } from "react";

import { obtenerPlanCalibracionMantenimiento } from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

export function usePlanCalibracionMantenimiento(id: number | null) {
  const [plan, setPlan] = useState<PlanCalibracionMantenimiento | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) {
      return;
    }

    const cargarPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerPlanCalibracionMantenimiento(id);
        setPlan(data);
      } catch (err) {
        setError("No se pudo cargar el plan de calibración y mantenimiento");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarPlan();
  }, [id]);

  return { plan, loading, error };
}
