import { useEffect, useState } from "react";
import { obtenerInsumoQuimico } from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

export function useInsumoQuimico(id: number | null) {
  const [insumoQuimico, setInsumoQuimico] = useState<InsumoQuimico | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null || isNaN(id)) return;

    const cargarInsumoQuimico = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerInsumoQuimico(id);
        setInsumoQuimico(data);
      } catch (err) {
        setError("No se pudo cargar el insumo químico");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarInsumoQuimico();
  }, [id]);

  return { insumoQuimico, loading, error };
}



