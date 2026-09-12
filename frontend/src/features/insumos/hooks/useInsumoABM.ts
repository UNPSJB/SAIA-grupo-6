import { useState } from "react";
import {
    crearInsumo,
    modificarInsumo,
    eliminarInsumo,
} from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumoABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const alta = async (insumo: Omit<Insumo, "id">) => {
        try {
            setLoading(true);
            setError(null);

            return await crearInsumo(insumo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear el insumo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const modificar = async (
        id: number,
        insumo: Omit<Insumo, "id">
    ) => {
        try {
            setLoading(true);
            setError(null);

            return await modificarInsumo(id, insumo);
        } catch (err) {
            setError("No se pudo modificar el insumo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const borrar = async (id: number) => {
        try {
            setLoading(true);
            setError(null);

            await eliminarInsumo(id);
        } catch (err) {
            setError("No se pudo eliminar el insumo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        alta,
        modificar,
        borrar,
        loading,
        error,
    };
}