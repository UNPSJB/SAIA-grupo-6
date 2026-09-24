import { useEffect, useState } from "react";
import { obtenerElementoLimpieza } from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

export function useElementoLimpieza(id: number | null) {
  const [elementoLimpieza, setElementoLimpieza] =
    useState<ElementoLimpieza | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) {
      setElementoLimpieza(null);
      setError(null);
      return;
    }

    const cargarElementoLimpieza = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await obtenerElementoLimpieza(id);
        setElementoLimpieza(data);
      } catch (err) {
        setError("No se pudo cargar el elemento de limpieza");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    cargarElementoLimpieza();
  }, [id]);

  return {
    elementoLimpieza,
    loading,
    error,
  };
}

