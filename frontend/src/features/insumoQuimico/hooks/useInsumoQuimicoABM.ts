import { useABM } from "../../../common/hooks/useABM";
import {
  crearInsumoQuimico,
  modificarInsumoQuimico,
  eliminarInsumoQuimico,
  reactivarInsumoQuimico,
} from "../services/insumoQuimicoService";
import type { InsumoQuimico, InsumoQuimicoFormValues } from "../types/insumoQuimico";

export function useInsumoQuimicoABM() {
  return useABM<InsumoQuimicoFormValues, InsumoQuimico>({
    crear: crearInsumoQuimico,
    modificar: modificarInsumoQuimico,
    eliminar: eliminarInsumoQuimico,
    reactivar: reactivarInsumoQuimico,
    etiqueta: "el insumo químico",
  });
}