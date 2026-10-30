import { useEffect, useState } from "react";
import { listarLotesStock } from "../services/stockService";
import type { FiltrosLotesStock, LotesStockResponse } from "../types/stock";

const RESPUESTA_INICIAL: LotesStockResponse = { items: [], total: 0, limit: 10, offset: 0 };

export function useLotesStock(filtros: FiltrosLotesStock) {
  const [lotes, setLotes] = useState<LotesStockResponse>(RESPUESTA_INICIAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { proveedor_id, insumo_quimico_id, numero_lote, limit, offset } = filtros;

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const respuesta = await listarLotesStock({ proveedor_id, insumo_quimico_id, numero_lote, limit, offset });
        if (vigente) setLotes(respuesta);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudieron obtener los lotes");
      } finally {
        if (vigente) setLoading(false);
      }
    })();
    return () => { vigente = false; };
  }, [proveedor_id, insumo_quimico_id, numero_lote, limit, offset]);

  return { lotes, loading, error };
}
