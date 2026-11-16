import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarReclamos } from "../services/reclamoService";
import type { ReclamoResumen } from "../types/reclamo";

/**
 * Reclamo vinculado a un incidente concreto.
 *
 * La relación se guarda del lado del reclamo (`incidente_id`), por eso se
 * consulta el listado filtrado en vez de leer un campo del incidente. Si el
 * incidente todavía no cargó (o no es de tipo reclamo), no se pide nada.
 */
export function useReclamoDeIncidente(incidenteId?: number | null) {
  const cargar = useCallback(
    () =>
      incidenteId
        ? listarReclamos({ incidente_id: incidenteId })
        : Promise.resolve<ReclamoResumen[]>([]),
    [incidenteId]
  );

  const { items, loading, error } = useLista<ReclamoResumen[]>({
    cargar,
    dependencias: [incidenteId],
    valorInicial: [],
    mensajeError: "No se pudo cargar el reclamo asociado",
  });

  return { reclamos: items, loading, error };
}
