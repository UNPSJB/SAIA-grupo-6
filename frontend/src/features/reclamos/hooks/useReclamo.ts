import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerReclamo } from "../services/reclamoService";
import type { ReclamoDetalle } from "../types/reclamo";

export function useReclamo(id: number | null) {
  const { registro, loading, error, recargar } = useRegistro<ReclamoDetalle>({
    cargar: obtenerReclamo,
    id,
    etiqueta: "el reclamo",
  });

  return { reclamo: registro, loading, error, recargar };
}
