import { useCallback, useState } from "react";
import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerPlan } from "../services/planAccionService";
import type { PlanDetalle } from "../types/planAccion";

/**
 * Plan de acción por id. Cada operación del backend devuelve el plan ya
 * actualizado: `reemplazar` lo toma directo, sin volver a pedirlo.
 */
export function usePlan(id: number | null) {
  const { registro, loading, error, recargar } = useRegistro<PlanDetalle>({
    cargar: obtenerPlan,
    id,
    etiqueta: "el plan de acción",
  });
  const [reemplazo, setReemplazo] = useState<PlanDetalle | null>(null);

  const reemplazar = useCallback((plan: PlanDetalle) => setReemplazo(plan), []);

  // El reemplazo solo vale para el mismo plan, y mientras no llegue una recarga
  // más nueva del servidor.
  const plan = reemplazo && reemplazo.id === id ? reemplazo : registro;

  const volverAPedir = useCallback(async () => {
    setReemplazo(null);
    await recargar();
  }, [recargar]);

  return { plan, loading, error, reemplazar, recargar: volverAPedir };
}
