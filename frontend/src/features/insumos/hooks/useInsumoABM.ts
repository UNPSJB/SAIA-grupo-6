import { useABM } from "../../../common/hooks/useABM";
import {
    crearInsumo,
    modificarInsumo,
    eliminarInsumo,
    reactivarInsumo,
} from "../services/insumoService";
import type { Insumo } from "../types/insumo";
import type { InsumoInput } from "../types/insumo";

export function useInsumoABM() {
    return useABM<InsumoInput, Insumo>({
        crear: crearInsumo,
        modificar: modificarInsumo,
        eliminar: eliminarInsumo,
        reactivar: reactivarInsumo,
        etiqueta: "el insumo",
    });
}