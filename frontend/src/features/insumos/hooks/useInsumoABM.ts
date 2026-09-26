import { useState } from "react";
import {
    crearInsumo,
    modificarInsumo,
    eliminarInsumo,
    reactivarInsumo,
} from "../services/insumoService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { InsumoFormValues } from "../types/insumo";

interface ConflictoInactivo {
    id: number;
    mensaje: string;
    campo: string;
}

export function useInsumoABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

    const alta = async (insumo: InsumoFormValues) => {
        try {
            setLoading(true);
            setError(null);
            setConflicto(null);
            return await crearInsumo(insumo);
        } catch (err) {
            if (err instanceof ConflictoInactivoError) {
                setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
            } else {
                setError(err instanceof Error ? err.message : "No se pudo crear el insumo");
            }
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const reactivar = async (id: number, insumo: InsumoFormValues) => {
        try {
            setLoading(true);
            setError(null);
            const resultado = await reactivarInsumo(id, insumo);
            setConflicto(null);
            return resultado;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al reactivar el insumo");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const cancelarConflicto = () => setConflicto(null);

     const modificar = async (id: number, insumo: Partial<InsumoFormValues>) => {
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
        reactivar,
        conflicto,
        cancelarConflicto,
        loading,
        error,
    };
}
