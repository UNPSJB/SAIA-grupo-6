import type { Insumo, InsumoFormValues } from "../types/insumo";
import { ConflictoInactivoError } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function listarInsumos(incluirInactivos = false): Promise<Insumo[]> {
    const query = incluirInactivos ? "?incluir_inactivos=true" : "";
    const response = await apiFetch(`${API_URL}/insumos${query}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener los insumos");
    }

    return response.json();
}

export async function obtenerInsumo(id: number): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener el insumo");
    }

    return response.json();
}

export async function crearInsumo(
    insumo: InsumoFormValues
): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(insumo),
    });

     if (response.status === 409) {
        const errorData = await response.json().catch(() => null);
        const detail = errorData?.detail;
        if (detail && typeof detail === "object" && detail.tipo === "inactivo") {
            throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo);
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al crear el insumo");
    }
    return response.json();
}

export async function modificarInsumo(
    id: number,
    insumo: Partial<InsumoFormValues>
): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`, {
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

export async function reactivarInsumo(id: number, insumo: InsumoFormValues): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...insumo, activo: true }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al reactivar el insumo");
    }

    return response.json();
}

export async function eliminarInsumo(id: number): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al borrar el insumo");
    }

    return response.json();
}
