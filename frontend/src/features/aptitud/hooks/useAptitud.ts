import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerAptitud } from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

export function useAptitud(id: number | null) {
  const { registro, loading, error } = useRegistro<Aptitud>({
    cargar: obtenerAptitud,
    id,
    etiqueta: "la aptitud",
  });

  return { aptitud: registro, loading, error };
}