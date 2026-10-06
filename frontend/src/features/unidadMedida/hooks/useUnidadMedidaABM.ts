import { useABM } from "../../../common/hooks/useABM";
import {
  crearUnidadMedida,
  modificarUnidadMedida,
  eliminarUnidadMedida,
  reactivarUnidadMedida,
} from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

type UnidadMedidaInput = Omit<UnidadMedida, "id" | "activo">;

export function useUnidadMedidaABM() {
  return useABM<UnidadMedidaInput, UnidadMedida>({
    crear: crearUnidadMedida,
    modificar: modificarUnidadMedida,
    eliminar: eliminarUnidadMedida,
    reactivar: reactivarUnidadMedida,
    etiqueta: "la unidad de medida",
  });
}