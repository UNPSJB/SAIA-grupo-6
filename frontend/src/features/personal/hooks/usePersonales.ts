import { useCallback, useEffect, useState } from "react";
import { listarPersonal } from "../services/personalService";
import type { Persona } from "../types/personal";

export function usePersonales(incluirInactivos = false) {
    const [personales, setPersonales] = useState<Persona[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargarPersonales = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listarPersonal(incluirInactivos);
            setPersonales(data);
        } catch (err) {
            setError("No se pudo cargar el personal");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [incluirInactivos]);

    useEffect(() => {
        cargarPersonales();
    }, [cargarPersonales]);

    return { personales, loading, error, cargarPersonales };
}
