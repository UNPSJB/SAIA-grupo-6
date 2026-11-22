import { useABM } from "../../../common/hooks/useABM";
import {
    crearIngrediente,
    modificarIngrediente,
    eliminarIngrediente,
    reactivarIngrediente,
} from "../services/ingredienteService";
import type { Ingrediente } from "../types/ingrediente";
import type { IngredienteInput } from "../types/ingrediente";

export function useIngredienteABM() {
    return useABM<IngredienteInput, Ingrediente>({
        crear: crearIngrediente,
        modificar: modificarIngrediente,
        eliminar: eliminarIngrediente,
        reactivar: reactivarIngrediente,
        etiqueta: "el ingrediente",
    });
}