import { useABM } from "../../../common/hooks/useABM";
import {
  crearEquipo,
  modificarEquipo,
  eliminarEquipo,
  reactivarEquipo,
} from "../services/equipoService";
import type { Equipo } from "../types/equipo";

type EquipoInput = Omit<Equipo, "id">;

export function useEquipoABM() {
  return useABM<EquipoInput, Equipo>({
    crear: crearEquipo,
    modificar: modificarEquipo,
    eliminar: eliminarEquipo,
    reactivar: reactivarEquipo,
    etiqueta: "el equipo",
  });
}