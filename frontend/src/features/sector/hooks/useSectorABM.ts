import { useABM } from "../../../common/hooks/useABM";
import {
  crearSector,
  modificarSector,
  eliminarSector,
  reactivarSector,
} from "../services/sectorService";
import type { Sector } from "../types/sector";

type SectorInput = Omit<Sector, "id" | "activo">;

export function useSectorABM() {
  return useABM<SectorInput, Sector>({
    crear: crearSector,
    modificar: modificarSector,
    eliminar: eliminarSector,
    reactivar: reactivarSector,
    etiqueta: "el sector",
  });
}