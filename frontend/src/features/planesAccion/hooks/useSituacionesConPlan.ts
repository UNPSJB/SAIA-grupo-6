import { useMemo } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarSituacionesConPlan } from "../services/planAccionService";
import type { SituacionConPlan } from "../types/planAccion";

/**
 * Plan activo de cada alerta (por la clave de la alerta), para que el centro
 * de notificaciones muestre "Plan #3" en vez de ofrecer crear otro. Si falla,
 * no rompe la pantalla: simplemente no hay planes que mostrar.
 */
export function useSituacionesConPlan() {
  const { items } = useLista<SituacionConPlan[]>({
    cargar: listarSituacionesConPlan,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los planes de acción",
    vaciarAlFallar: true,
  });
  return useMemo(() => new Map(items.map((fila) => [fila.clave_alerta, fila])), [items]);
}
