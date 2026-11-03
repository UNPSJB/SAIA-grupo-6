import { useCallback, useEffect, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarInsumosDisponibles,
  listarLotes,
  listarProductos,
  obtenerDashboardLotes,
  obtenerLote,
} from "../services/loteService";
import type {
  DashboardLotes,
  FiltrosLotes,
  InsumoResumen,
  Lote,
  Producto,
} from "../types/lote";

const DASHBOARD_VACIO: DashboardLotes = {
  total_lotes: 0,
  total_cantidad_planificada: 0,
  total_cantidad_producida: 0,
  porcentaje_cumplimiento: 0,
  por_estado: [],
  por_producto: [],
};

export function useLotes(filtros: FiltrosLotes = {}) {
  const { producto, fechaDesde, fechaHasta } = filtros;

  const cargar = useCallback(
    () => listarLotes({ producto, fechaDesde, fechaHasta }),
    [producto, fechaDesde, fechaHasta]
  );

  const { items, loading, error, recargar } = useLista<Lote[]>({
    cargar,
    dependencias: [producto, fechaDesde, fechaHasta],
    valorInicial: [],
    mensajeError: "No se pudo cargar el historial de lotes",
  });

  return { lotes: items, loading, error, recargar };
}

export function useLote(loteId: number) {
  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const resultado = await obtenerLote(loteId);
        if (!cancelado) setLote(resultado);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error ? err.message : "No se pudo cargar el lote"
          );
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [loteId]);

  return { lote, loading, error };
}

export function useProductos() {
  const cargar = useCallback(() => listarProductos(), []);

  const { items, loading, error } = useLista<Producto[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los productos",
  });

  return { productos: items, loading, error };
}

export function useInsumosDisponibles() {
  const cargar = useCallback(() => listarInsumosDisponibles(), []);

  const { items, loading, error } = useLista<InsumoResumen[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos disponibles",
  });

  return { insumos: items, loading, error };
}

export function useDashboardLotes(filtros: FiltrosLotes = {}) {
  const { producto, fechaDesde, fechaHasta } = filtros;

  const cargar = useCallback(
    () => obtenerDashboardLotes({ producto, fechaDesde, fechaHasta }),
    [producto, fechaDesde, fechaHasta]
  );

  const { items, loading, error, recargar } = useLista<DashboardLotes>({
    cargar,
    dependencias: [producto, fechaDesde, fechaHasta],
    valorInicial: DASHBOARD_VACIO,
    mensajeError: "No se pudieron cargar las estadísticas de producción",
  });

  return { dashboard: items, loading, error, recargar };
}
