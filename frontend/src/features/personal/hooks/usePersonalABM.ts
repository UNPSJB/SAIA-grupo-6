import { useState } from "react";
import { crearPersona, modificarPersona, eliminarPersona } from "../services/personalService";
import type { Persona } from "../types/personal";

type PersonaInput = Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;

export function usePersonalABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const alta = async (persona: PersonaInput) => {
        try {
            setLoading(true);
            setError(null);
            return await crearPersona(persona);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al crear personal");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const modificar = async (id: number, persona: PersonaInput) => {
        try {
            setLoading(true);
            setError(null);
            return await modificarPersona(id, persona);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al modificar personal");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const borrar = async (id: number) => {
        try {
            setLoading(true);
            setError(null);
            await eliminarPersona(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al eliminar personal");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { alta, modificar, borrar, loading, error };
}