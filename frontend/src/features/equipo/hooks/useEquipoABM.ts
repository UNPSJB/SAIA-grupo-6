import { useState } from "react";
import { crearEquipo, modificarEquipo, eliminarEquipo, reactivarEquipo } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipoABM() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const alta = async (equipo: Omit<Equipo, "id">) => {
        try {
            setLoading(true);
            setError(null);

            return await crearEquipo(equipo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear el equipo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const modificar = async (
        id: number,
        equipo: Omit<Equipo, "id">
    ) => {
        try {
            setLoading(true);
            setError(null);

            return await modificarEquipo(id, equipo);
        } catch (err) {
            setError("No se pudo modificar el equipo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const borrar = async (id: number) => {
        try {
            setLoading(true);
            setError(null);

            await eliminarEquipo(id);
        } catch (err) {
            setError("No se pudo eliminar el equipo");
            console.error(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const reactivar = async (id: number, equipo: Omit<Equipo, "id">) => {
        try {
            setLoading(true);
            setError(null);
            return await reactivarEquipo(id, equipo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al reactivar");
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
        loading,
        error,
    };
}