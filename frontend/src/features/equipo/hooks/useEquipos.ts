import { useCallback, useEffect, useState } from "react";
import { listarEquipos } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipos() {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarEquipos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await listarEquipos();
            setEquipos(data);
        } catch (err) {
            setError("No se pudieron cargar los equipos");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarEquipos();
    }, [cargarEquipos]);

    return {
        equipos,
        loading,
        error,
        cargarEquipos,
    };
}