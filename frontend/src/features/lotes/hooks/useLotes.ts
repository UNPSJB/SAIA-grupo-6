import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarLotes, obtenerDashboardLotes } from "../services/loteService";
import type { DashboardLotes, FiltrosLotes, LoteResumen } from "../types/lote";

const DASHBOARD_VACIO: DashboardLotes = {
  total_lotes: 0,
  total_cantidad_producida: 0,
  por_estado: [],
  por_producto: [],
};

export function useLotes(filtros: FiltrosLotes = {}) {
  const { estado, fechaDesde, fechaHasta } = filtros;

  const cargar = useCallback(
    () => listarLotes({ estado, fechaDesde, fechaHasta }),
    [estado, fechaDesde, fechaHasta],
  );

  const { items, loading, error, recargar } = useLista<LoteResumen[]>({
    cargar,
    dependencias: [estado, fechaDesde, fechaHasta],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes de producción",
  });

  return { lotes: items, loading, error, recargar };
}

export function useDashboardLotes(filtros: FiltrosLotes = {}) {
  const { fechaDesde, fechaHasta } = filtros;

  const cargar = useCallback(
    () => obtenerDashboardLotes({ fechaDesde, fechaHasta }),
    [fechaDesde, fechaHasta],
  );

  const { items, loading, error, recargar } = useLista<DashboardLotes>({
    cargar,
    dependencias: [fechaDesde, fechaHasta],
    valorInicial: DASHBOARD_VACIO,
    mensajeError: "No se pudieron cargar las estadísticas de producción",
  });

  return { dashboard: items, loading, error, recargar };
}
