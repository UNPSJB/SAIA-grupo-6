import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerIncidente } from "../services/incidenteService";
import type { Incidente } from "../types/incidente";

export function useIncidente(id: number | null) {
  const { registro, loading, error, recargar } = useRegistro<Incidente>({
    cargar: obtenerIncidente,
    id,
    etiqueta: "el incidente",
  });

  return { incidente: registro, loading, error, recargar };
}
