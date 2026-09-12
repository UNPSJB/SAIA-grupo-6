import { useEffect, useState } from "react";
import { obtenerInsumo } from "../services/insumoService";
import type { Insumo } from "../types/insumo";

export function useInsumo(id: number | null) {
    const [insumo, setInsumo] = useState<Insumo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id === null) {
            return;
        }

        const cargarInsumo = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await obtenerInsumo(id);
                setInsumo(data);
            } catch (err) {
                setError("No se pudo cargar el insumo");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        cargarInsumo();
    }, [id]);

    return {
        insumo,
        loading,
        error,
    };
}