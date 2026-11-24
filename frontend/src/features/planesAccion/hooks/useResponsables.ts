import { useLista } from "../../../common/hooks/useLista";
import { listarResponsables } from "../services/planAccionService";
import type { ResponsablePosible } from "../types/planAccion";

/** Personal activo al que se le puede asignar un plan o una acción. */
export function useResponsables() {
  const { items, loading, error } = useLista<ResponsablePosible[]>({
    cargar: listarResponsables,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudo cargar el personal",
  });
  return { responsables: items, loading, error };
}
