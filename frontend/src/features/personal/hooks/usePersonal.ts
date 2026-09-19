import { useEffect, useState } from "react";
import { obtenerPersona } from "../services/personalService";
import type { Persona } from "../types/personal";

export function usePersonal(id: number | null) {
    const [persona, setPersona] = useState<Persona | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id === null) return;
        const cargarPersona = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await obtenerPersona(id);
                setPersona(data);
            } catch (err) {
                setError("No se pudo cargar el personal");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        cargarPersona();
    }, [id]);

    return { persona, loading, error };
}