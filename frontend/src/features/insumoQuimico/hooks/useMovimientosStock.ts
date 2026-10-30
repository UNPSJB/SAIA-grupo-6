import { useEffect, useState } from "react";
import { listarMovimientosStock } from "../services/stockService";
import type { FiltrosMovimientosStock, MovimientosStockResponse } from "../types/stock";

const RESPUESTA_INICIAL: MovimientosStockResponse = {
  items: [],
  total: 0,
  limit: 10,
  offset: 0,
};

export function useMovimientosStock(filtros: FiltrosMovimientosStock) {
  const [movimientos, setMovimientos] = useState<MovimientosStockResponse>(RESPUESTA_INICIAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { insumo_quimico_id, fecha_desde, fecha_hasta, tipo, limit, offset } = filtros;

  const recargar = async () => {
    try {
      setLoading(true);
      setError(null);
      setMovimientos(await listarMovimientosStock(filtros));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron obtener los movimientos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const respuesta = await listarMovimientosStock({
          insumo_quimico_id,
          fecha_desde,
          fecha_hasta,
          tipo,
          limit,
          offset,
        });
        if (vigente) setMovimientos(respuesta);
      } catch (err) {
        if (vigente) {
          setError(err instanceof Error ? err.message : "No se pudieron obtener los movimientos");
        }
      } finally {
        if (vigente) setLoading(false);
      }
    };

    void cargar();
    return () => {
      vigente = false;
    };
  }, [insumo_quimico_id, fecha_desde, fecha_hasta, tipo, limit, offset]);

  return { movimientos, loading, error, recargar };
}
