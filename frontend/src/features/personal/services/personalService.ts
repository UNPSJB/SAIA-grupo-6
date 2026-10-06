import type { Persona, PersonaInput } from "../types/personal";
import { pedir } from "../../../common/api/errors";


import { apiFetch, API_URL } from "../../../common/api/apiClient";



export async function listarPersonal(incluirInactivos = false): Promise<Persona[]> {
    const query = incluirInactivos ? "?incluir_inactivos=true" : "";
    const response = await apiFetch(`${API_URL}/personal${query}`);
    return pedir<Persona[]>(response, "Error al obtener el personal");
}

export async function obtenerPersona(id: number): Promise<Persona> {
    const response = await apiFetch(`${API_URL}/personal/${id}`);
    return pedir<Persona>(response, "Error al obtener la persona");
}

export async function crearPersona(persona: PersonaInput): Promise<Persona> {
    const response = await apiFetch(`${API_URL}/personal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });

    return pedir<Persona>(response, "Error al crear el registro");
}

export async function modificarPersona(id: number, persona: PersonaInput): Promise<Persona> {
    const response = await apiFetch(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });

    return pedir<Persona>(response, "Error al modificar el registro");
}

// Reactiva a alguien dado de baja, pisando sus datos con los valores nuevos.
// No es un endpoint nuevo: reusa el PUT /personal/{id} de siempre, solo que
// le manda `activo: true` además de los campos del formulario (PersonaUpdate
// ya soporta ese campo).
export async function reactivarPersona(id: number, persona: PersonaInput): Promise<Persona> {
    const response = await apiFetch(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...persona, activo: true }),
    });
    return pedir<Persona>(response, "Error al reactivar el personal");
}

export async function eliminarPersona(id: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/personal/${id}`, {
        method: "DELETE",
    });
    return pedir<void>(response, "Error al eliminar el registro");
}