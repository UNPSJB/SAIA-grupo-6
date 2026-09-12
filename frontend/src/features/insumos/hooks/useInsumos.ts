import { useCallback, useEffect, useState } from "react";
import { listarInsumos } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumos() {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarInsumos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await listarInsumos();
            setInsumos(data);
        } catch (err) {
            setError("No se pudieron cargar los insumos");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarInsumos();
    }, [cargarInsumos]);

    return {
        insumos,
        loading,
        error,
        cargarInsumos,
    };
}