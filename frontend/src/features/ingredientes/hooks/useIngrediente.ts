import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerIngrediente } from "../services/ingredienteService";
import type { Ingrediente } from "../types/ingrediente";

export function useIngrediente(id: number | null) {
    const { registro, loading, error } = useRegistro<Ingrediente>({
        cargar: obtenerIngrediente,
        id,
        etiqueta: "el ingrediente",
    });

    return {
        ingrediente: registro,
        loading,
        error,
    };
}