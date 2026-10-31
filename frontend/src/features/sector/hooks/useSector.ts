import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerSector } from "../services/sectorService";
import type { Sector } from "../types/sector";

export function useSector(id: number | null) {
  const { registro, loading, error } = useRegistro<Sector>({
    cargar: obtenerSector,
    id,
    etiqueta: "el sector",
  });

  return { sector: registro, loading, error };
}