import type { Insumo } from "../types/insumo";

const API_URL = "http://localhost:8000";

export async function listarInsumos(): Promise<Insumo[]> {
    const response = await fetch(`${API_URL}/insumos`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener los insumos");
    }

    return response.json();
}

export async function obtenerInsumo(id: number): Promise<Insumo> {
    const response = await fetch(`${API_URL}/insumos/${id}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener el insumo");
    }

    return response.json();
}

export async function crearInsumo(
    insumo: Omit<Insumo, "id">
): Promise<Insumo> {
    const response = await fetch(`${API_URL}/insumos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(insumo),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al crear el insumo");
    }

    return response.json();
}

export async function modificarInsumo(
    id: number,
    insumo: Omit<Insumo, "id">
): Promise<Insumo> {
    const response = await fetch(`${API_URL}/insumos/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(insumo),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al modificar el insumo");
    }

    return response.json();
}

export async function eliminarInsumo(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/insumos/${id}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al eliminar el insumo");
    }
}
