import { useCallback, useState } from "react";
import { consultarCompletitud } from "../services/rotuladoService";
import type { CompletitudRotulado } from "../types/rotulado";

interface UseCompletitudReturn {
  completitud: CompletitudRotulado | null;
  loading: boolean;
  error: string | null;
  consultarCompletitud: (borradorId: number) => Promise<void>;
  campoEstado: (nombreCampo: string) => string | null;
  hayFaltantes: boolean;
  camposPendientes: string[];
}

export function useCompletitud(): UseCompletitudReturn {
  const [completitud, setCompletitud] = useState<CompletitudRotulado | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (borradorId: number) => {
    setLoading(true);
    setError(null);
    try {
      const datos = await consultarCompletitud(borradorId);
      setCompletitud(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar completitud");
    } finally {
      setLoading(false);
    }
  }, []);

  const campoEstado = useCallback(
    (nombreCampo: string) => {
      return completitud?.campos.find((c) => c.nombre === nombreCampo)?.estado ?? null;
    },
    [completitud],
  );

  const hayFaltantes = completitud
    ? completitud.campos.some(
        (c) => c.estado === "pendiente" || c.estado === "sin_datos_origen",
      )
    : false;

  const camposPendientes = completitud
    ? completitud.campos
        .filter(
          (c) =>
            c.estado === "pendiente" || c.estado === "sin_datos_origen",
        )
        .map((c) => c.etiqueta)
    : [];

  return {
    completitud,
    loading,
    error,
    consultarCompletitud: consultar,
    campoEstado,
    hayFaltantes,
    camposPendientes,
  };
}
