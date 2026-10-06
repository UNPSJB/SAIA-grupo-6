import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerInsumo } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumo(id: number | null) {
    const { registro, loading, error } = useRegistro<Insumo>({
        cargar: obtenerInsumo,
        id,
        etiqueta: "el insumo",
    });

    return {
        insumo: registro,
        loading,
        error,
    };
}