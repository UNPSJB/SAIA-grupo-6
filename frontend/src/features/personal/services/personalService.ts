import type { Persona } from "../types/personal";

const API_URL = "http://localhost:8000";

export async function listarPersonal(): Promise<Persona[]> {
    const response = await fetch(`${API_URL}/personal`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener el personal");
    }
    return response.json();
}

export async function obtenerPersona(id: number): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal/${id}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener la persona");
    }
    return response.json();
}

export async function crearPersona(persona: Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al crear el registro");
    }
    return response.json();
}

export async function modificarPersona(id: number, persona: Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">): Promise<Persona> {
    const response = await fetch(`${API_URL}/personal/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al modificar el registro");
    }
    return response.json();
}

export async function eliminarPersona(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/personal/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al eliminar el registro");
    }
}