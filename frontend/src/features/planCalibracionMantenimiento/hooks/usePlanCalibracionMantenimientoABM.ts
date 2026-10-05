import { useState } from "react";

import {
  crearPlanCalibracionMantenimiento,
  modificarPlanCalibracionMantenimiento,
} from "../services/planCalibracionMantenimientoService";
import type {
  PlanCalibracionMantenimientoCreate,
  PlanCalibracionMantenimientoUpdate,
} from "../types/planCalibracionMantenimiento";

export function usePlanCalibracionMantenimientoABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alta = async (plan: PlanCalibracionMantenimientoCreate) => {
    try {
      setLoading(true);
      setError(null);
      return await crearPlanCalibracionMantenimiento(plan);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear el plan de calibración y mantenimiento",
      );
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const modificar = async (
    id: number,
    plan: PlanCalibracionMantenimientoUpdate,
  ) => {
    try {
      setLoading(true);
      setError(null);
      return await modificarPlanCalibracionMantenimiento(id, plan);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo modificar el plan de calibración y mantenimiento",
      );
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { alta, modificar, loading, error };
}
