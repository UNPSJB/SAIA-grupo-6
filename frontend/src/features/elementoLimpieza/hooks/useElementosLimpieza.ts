import { useCallback, useEffect, useState } from "react";
import { listarElementosLimpieza } from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

export function useElementosLimpieza(incluirInactivos = false) {
  const [elementosLimpieza, setElementosLimpieza] = useState<ElementoLimpieza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarElementosLimpieza = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarElementosLimpieza(incluirInactivos);
      setElementosLimpieza(data);
    } catch (err) {
      setError("No se pudieron cargar los elementos de limpieza");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    cargarElementosLimpieza();
  }, [cargarElementosLimpieza]);

  return {
    elementosLimpieza,
    loading,
    error,
    cargarElementosLimpieza,
  };
}