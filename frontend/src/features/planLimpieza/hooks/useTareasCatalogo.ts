import { useCallback, useEffect, useState } from "react";
import { listarTareas, crearTarea } from "../services/planLimpiezaService";
import type { Tarea } from "../types/planLimpieza";

export function useTareasCatalogo() {
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [creando, setCreando] = useState(false);
    const [errorCreacion, setErrorCreacion] = useState<string | null>(null);

    const cargarTareas = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listarTareas();
            setTareas(data);
        } catch (err) {
            setError("No se pudieron cargar las tareas");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarTareas();
    }, [cargarTareas]);

    const agregarTarea = async (nombre: string) => {
        try {
            setCreando(true);
            setErrorCreacion(null);
            const nueva = await crearTarea(nombre);
            setTareas((prev) => [...prev, nueva]);
            return nueva;
        } catch (err) {
            setErrorCreacion(err instanceof Error ? err.message : "No se pudo crear la tarea");
            throw err;
        } finally {
            setCreando(false);
        }
    };

    return { tareas, loading, error, agregarTarea, creando, errorCreacion };
}
