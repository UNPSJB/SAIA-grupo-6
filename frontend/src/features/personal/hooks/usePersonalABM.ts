import { useState } from "react";
import {
    crearPersona,
    modificarPersona,
    eliminarPersona,
    reactivarPersona,
} from "../services/personalService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { Persona } from "../types/personal";

type PersonaInput = Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;

interface ConflictoInactivo {
    id: number;
    mensaje: string;
    campo: string;
}

export function usePersonalABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Cuando el alta choca con un dni/email de alguien inactivo, guardamos
    // acá los datos del conflicto para que la página pueda mostrar el
    // diálogo de "¿querés reactivarlo?" en vez de un simple cartel de error.
    const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

    const alta = async (persona: PersonaInput) => {
        try {
            setLoading(true);
            setError(null);
            setConflicto(null);
            return await crearPersona(persona);
        } catch (err) {
            if (err instanceof ConflictoInactivoError) {
                setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
            } else {
                setError(err instanceof Error ? err.message : "Error al crear personal");
            }
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const reactivar = async (id: number, persona: PersonaInput) => {
        try {
            setLoading(true);
            setError(null);
            const resultado = await reactivarPersona(id, persona);
            setConflicto(null);
            return resultado;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al reactivar personal");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const cancelarConflicto = () => setConflicto(null);

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

    return {
        alta,
        modificar,
        borrar,
        reactivar,
        conflicto,
        cancelarConflicto,
        loading,
        error,
    };
}
