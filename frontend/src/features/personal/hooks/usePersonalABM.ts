import { useABM } from "../../../common/hooks/useABM";
import {
    crearPersona,
    modificarPersona,
    eliminarPersona,
    reactivarPersona,
} from "../services/personalService";
import type { Persona, PersonaInput } from "../types/personal";

export function usePersonalABM() {
    return useABM<PersonaInput, Persona>({
        crear: crearPersona,
        modificar: modificarPersona,
        eliminar: eliminarPersona,
        reactivar: reactivarPersona,
        etiqueta: "el personal",
    });
}