import { useEffect, useState } from "react";
import { listarStockActual } from "../services/stockService";
import type { StockInsumoQuimico } from "../types/stock";

export function useStockActual() {
  const [stock, setStock] = useState<StockInsumoQuimico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = async () => {
    try {
      setLoading(true);
      setError(null);
      setStock(await listarStockActual());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener el stock actual");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void recargar();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return { stock, loading, error, recargar };
}
