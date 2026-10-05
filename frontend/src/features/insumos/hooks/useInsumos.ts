import { useState, useEffect, useCallback } from "react";
import { listarInsumos } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumos(incluirInactivos = false) {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarInsumos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await listarInsumos(incluirInactivos);
            setInsumos(data);
        } catch (err) {
            setError("No se pudieron cargar los insumos");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [incluirInactivos]);

    useEffect(() => {
        const timeoutId = window.setTimeout(cargarInsumos, 0);
        return () => window.clearTimeout(timeoutId);
    }, [cargarInsumos]);

    return {
        insumos,
        loading,
        error,
        cargarInsumos,
    };
}
