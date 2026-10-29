import type { Insumo, InsumoFormValues } from "../types/insumo";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";


export type ColumnaOrdenInsumo = "nombre" | "unidad";
export type OrdenInsumo = `${ColumnaOrdenInsumo}_asc` | `${ColumnaOrdenInsumo}_desc`;

export interface FiltrosInsumos {
    incluirInactivos?: boolean;
    buscar?: string;
    unidadMedidaId?: number;
    orden?: OrdenInsumo;
}

export async function listarInsumos(
    page: number,
    pageSize: number,
    filtros: FiltrosInsumos = {}
): Promise<Pagina<Insumo>> {
    const query = queryPagina(page, pageSize, {
        incluir_inactivos: filtros.incluirInactivos || undefined,
        buscar: filtros.buscar?.trim() || undefined,
        unidad_medida_id: filtros.unidadMedidaId,
        orden: filtros.orden,
    });
    const response = await apiFetch(`${API_URL}/insumos${query}`);

    return pedir<Pagina<Insumo>>(response, "Error al obtener los insumos");
}

export async function obtenerInsumo(id: number): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`);

    return pedir<Insumo>(response, "Error al obtener el insumo");
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

    return pedir<Insumo>(response, "Error al crear el insumo");
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

    return pedir<Insumo>(response, "Error al modificar el insumo");
}

export async function reactivarInsumo(id: number, insumo: InsumoFormValues): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...insumo, activo: true }),
    });

    return pedir<Insumo>(response, "Error al reactivar el insumo");
}

export async function eliminarInsumo(id: number): Promise<Insumo> {
    const response = await apiFetch(`${API_URL}/insumos/${id}`, {
        method: "DELETE",
    });

    return pedir<Insumo>(response, "Error al borrar el insumo");
}