import { useState, useCallback, useEffect } from "react";
import { listarUnidadesMedida } from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

export function useUnidadesMedida(incluirInactivos = false) {
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarUnidades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarUnidadesMedida(incluirInactivos);
      setUnidades(data);
    } catch {
      setError("No se pudieron cargar las unidades de medida");
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarUnidades, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarUnidades]);

  return { unidades, loading, error, cargarUnidades };
}
