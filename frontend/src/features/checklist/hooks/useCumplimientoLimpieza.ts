import { useCallback, useMemo } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerHistorialDelRango } from "../services/checklistService";
import type { HistorialChecklistItem } from "../types/checklist";
import { cumplimientoPorDia } from "../types/cumplimiento";

/**
 * Cumplimiento de limpieza día por día en un rango de fechas.
 *
 * `habilitado` en `false` no pide nada: el historial exige permiso de
 * administración (un operador recibiría un 403) y tampoco se pide si el rango
 * es inválido.
 */
export function useCumplimientoLimpieza(
  desde: string,
  hasta: string,
  habilitado = true
) {
  const cargar = useCallback(async () => {
    if (!habilitado) return [];

    const respuesta = await obtenerHistorialDelRango(desde, hasta);
    return respuesta.checklists;
  }, [desde, hasta, habilitado]);

  const { items, loading, error, recargar } = useLista<HistorialChecklistItem[]>({
    cargar,
    dependencias: [desde, hasta, habilitado],
    valorInicial: [],
    mensajeError: "No se pudo cargar el cumplimiento de limpieza",
    // Si falla, no dejar en pantalla los datos de otro rango.
    vaciarAlFallar: true,
  });

  const serie = useMemo(
    () => (habilitado ? cumplimientoPorDia(items, desde, hasta) : []),
    [items, desde, hasta, habilitado]
  );

  return { serie, loading, error, recargar };
}