import { useEffect, useState } from "react";
import { obtenerEquipo } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipo(id: number | null) {
    const [equipo, setEquipo] = useState<Equipo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id === null) {
            return;
        }

        const cargarEquipo = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await obtenerEquipo(id);
                setEquipo(data);
            } catch (err) {
                setError("No se pudo cargar el equipo");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        cargarEquipo();
    }, [id]);

    return {
        equipo,
        loading,
        error,
    };
}