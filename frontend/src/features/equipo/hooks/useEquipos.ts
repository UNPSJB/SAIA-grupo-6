import { useCallback, useEffect, useState } from "react";
import { listarEquipos } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipos(incluirInactivos = false) {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarEquipos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listarEquipos(incluirInactivos);
            setEquipos(data);
        } catch (err) {
            setError("No se pudieron cargar los equipos");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [incluirInactivos]); 

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