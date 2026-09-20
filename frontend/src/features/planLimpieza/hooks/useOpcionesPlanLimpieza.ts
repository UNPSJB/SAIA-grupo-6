import { useEffect, useState } from "react";
import {
    listarOpcionesEquipos,
    listarOpcionesPersonal,
} from "../services/planLimpiezaService";
import type { EquipoOption, PersonalOption } from "../types/planLimpieza";

export function useOpcionesPlanLimpieza() {
    const [equipos, setEquipos] = useState<EquipoOption[]>([]);
    const [personal, setPersonal] = useState<PersonalOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const cargarOpciones = async () => {
            try {
                setLoading(true);
                setError(null);
                const [equiposData, personalData] = await Promise.all([
                    listarOpcionesEquipos(),
                    listarOpcionesPersonal(),
                ]);
                setEquipos(equiposData);
                setPersonal(personalData);
            } catch (err) {
                setError("No se pudieron cargar las opciones del formulario");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        cargarOpciones();
    }, []);

    return { equipos, personal, loading, error };
}
