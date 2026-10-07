import { useABM } from "../../../common/hooks/useABM";
import {
  crearAptitud,
  modificarAptitud,
  eliminarAptitud,
  reactivarAptitud,
} from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

type AptitudInput = Omit<Aptitud, "id" | "activo">;

export function useAptitudABM() {
  return useABM<AptitudInput, Aptitud>({
    crear: crearAptitud,
    modificar: modificarAptitud,
    eliminar: eliminarAptitud,
    reactivar: reactivarAptitud,
    etiqueta: "la aptitud",
  });
}