import { useEffect, useState } from "react";
import { obtenerUnidadMedida } from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

export function useUnidadMedida(id: number | null) {
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null || isNaN(id)) return;

    const cargarUnidadMedida = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerUnidadMedida(id);
        setUnidadMedida(data);
      } catch (err) {
        setError("No se pudo cargar la unidad de medida");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarUnidadMedida();
  }, [id]);

  return { unidadMedida, loading, error };
}
