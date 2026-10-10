import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerResumenIncidentesPorTipo } from "../services/incidenteService";
import type { IncidenteResumen } from "../types/incidente";

const RESUMEN_VACIO: IncidenteResumen = {
  estado: "abierto",
  total: 0,
  por_tipo: [],
};

/**
 * Carga el resumen de incidentes por tipo (indicador E7).
 * @param incluirCerrados Si es `true`, cuenta también los cerrados.
 */
export function useResumenIncidentesPorTipo(incluirCerrados = false) {
  const cargar = useCallback(
    () => obtenerResumenIncidentesPorTipo(incluirCerrados),
    [incluirCerrados]
  );

  const { items, loading, error } = useLista<IncidenteResumen>({
    cargar,
    dependencias: [incluirCerrados],
    valorInicial: RESUMEN_VACIO,
    mensajeError: "No se pudieron cargar los incidentes por tipo",
    preferirMensajeDelBackend: true,
  });

  return { resumen: items, loading, error };
}