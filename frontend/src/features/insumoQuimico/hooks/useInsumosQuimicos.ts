import { useState, useCallback, useEffect } from "react";
import { listarInsumosQuimicos } from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

export function useInsumosQuimicos(incluirInactivos = false) {
  const [insumos, setInsumos] = useState<InsumoQuimico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarInsumos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarInsumosQuimicos(incluirInactivos);
      setInsumos(data);
    } catch {
      setError("No se pudieron cargar los insumos químicos");
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarInsumos, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarInsumos]);

  return { insumos, loading, error, cargarInsumos };
}
