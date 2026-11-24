import { useCallback, useMemo } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarSituacionesConPlan,
  listarSituacionesDisponibles,
} from "../services/planAccionService";
import type { SituacionConPlan, SituacionDisponible } from "../types/planAccion";

interface DatosPlanes {
  disponibles: SituacionDisponible[];
  conPlan: SituacionConPlan[];
}

const VACIO: DatosPlanes = { disponibles: [], conPlan: [] };

/**
 * Lo que el centro de notificaciones necesita para ofrecer planes: qué alertas
 * se pueden tratar con uno (y cuáles SAIA sugiere) y cuáles ya tienen un plan
 * activo. Solo se pide si la persona puede operar; si falla no rompe la
 * pantalla, simplemente no se ofrece nada.
 */
export function usePlanesDeAlertas(habilitado: boolean) {
  const cargar = useCallback(async (): Promise<DatosPlanes> => {
    if (!habilitado) return VACIO;
    const [disponibles, conPlan] = await Promise.all([
      listarSituacionesDisponibles(),
      listarSituacionesConPlan(),
    ]);
    return { disponibles, conPlan };
  }, [habilitado]);

  const { items } = useLista<DatosPlanes>({
    cargar,
    dependencias: [habilitado],
    valorInicial: VACIO,
    mensajeError: "No se pudieron cargar los planes de acción",
    vaciarAlFallar: true,
  });

  return useMemo(() => {
    const disponiblesPorClave = new Map<string, SituacionDisponible>();
    for (const s of items.disponibles) {
      if (s.clave_alerta) disponiblesPorClave.set(s.clave_alerta, s);
    }
    const planPorClave = new Map(items.conPlan.map((fila) => [fila.clave_alerta, fila]));
    return { disponiblesPorClave, planPorClave };
  }, [items]);
}
