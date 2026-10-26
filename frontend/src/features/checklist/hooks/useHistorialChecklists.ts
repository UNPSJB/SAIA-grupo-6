import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerHistorialChecklists } from "../services/checklistService";
import type { HistorialChecklistPagina } from "../types/checklist";

/**
 * Una página del historial de checklists, con los filtros de rango y equipo
 * aplicados en el servidor.
 *
 * `page` entra en las dependencias a propósito: `useLista` arma su efecto con
 * `[recargar, ...dependencias]` y `recargar` depende de `cargar`, que cambia
 * de identidad cuando cambia la página — así cada cambio de `page` dispara el
 * re-fetch de esa página.
 */
export function useHistorialChecklists(
  fechaDesde: string,
  fechaHasta: string,
  equipoId: number | undefined,
  page: number,
  pageSize = 10
) {
  const cargarHistorial = useCallback(() => {
    // Guard del cliente: el backend también valida el rango (responde 400
    // `FechaInvalida`), pero avisar acá da un mensaje más claro y ahorra el
    // request.
    if (!fechaDesde || !fechaHasta) {
      throw new Error("Completá las fechas 'desde' y 'hasta'.");
    }
    if (fechaDesde > fechaHasta) {
      throw new Error("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
    }

    return obtenerHistorialChecklists(fechaDesde, fechaHasta, equipoId, page, pageSize);
  }, [fechaDesde, fechaHasta, equipoId, page, pageSize]);

  const { items, loading, error, recargar } = useLista<HistorialChecklistPagina | null>({
    cargar: cargarHistorial,
    dependencias: [fechaDesde, fechaHasta, equipoId, page],
    valorInicial: null,
    mensajeError: "Error al cargar el historial de checklists",
    preferirMensajeDelBackend: true,
    vaciarAlFallar: true,
  });

  return {
    historial: items,
    loading,
    error,
    recargar,
  };
}
