import type { Ingrediente, IngredienteInput } from "../types/ingrediente";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";


export type ColumnaOrdenIngrediente = "nombre" | "unidad";
export type OrdenIngrediente = `${ColumnaOrdenIngrediente}_asc` | `${ColumnaOrdenIngrediente}_desc`;

export interface FiltrosIngredientes {
    soloInactivos?: boolean;
    buscar?: string;
    unidadMedidaId?: number;
    esAditivo?: boolean;
    proveedorId?: number;
    orden?: OrdenIngrediente;
}

export async function listarIngredientes(
    page: number,
    pageSize: number,
    filtros: FiltrosIngredientes = {}
): Promise<Pagina<Ingrediente>> {
    const query = queryPagina(page, pageSize, {
        solo_inactivos: filtros.soloInactivos || undefined,
        buscar: filtros.buscar?.trim() || undefined,
        unidad_medida_id: filtros.unidadMedidaId,
        es_aditivo: filtros.esAditivo,
        proveedor_id: filtros.proveedorId,
        orden: filtros.orden,
    });
    const response = await apiFetch(`${API_URL}/ingredientes${query}`);

    return pedir<Pagina<Ingrediente>>(response, "Error al obtener los ingredientes");
}

export async function obtenerIngrediente(id: number): Promise<Ingrediente> {
    const response = await apiFetch(`${API_URL}/ingredientes/${id}`);

    return pedir<Ingrediente>(response, "Error al obtener el ingrediente");
}

export async function crearIngrediente(
    ingrediente: IngredienteInput
): Promise<Ingrediente> {
    const response = await apiFetch(`${API_URL}/ingredientes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(ingrediente),
    });

    return pedir<Ingrediente>(response, "Error al crear el ingrediente");
}

export async function modificarIngrediente(
    id: number,
    ingrediente: Partial<IngredienteInput>
): Promise<Ingrediente> {
    const response = await apiFetch(`${API_URL}/ingredientes/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(ingrediente),
    });

    return pedir<Ingrediente>(response, "Error al modificar el ingrediente");
}

export async function reactivarIngrediente(id: number, ingrediente: IngredienteInput): Promise<Ingrediente> {
    const response = await apiFetch(`${API_URL}/ingredientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ingrediente, activo: true }),
    });

    return pedir<Ingrediente>(response, "Error al reactivar el ingrediente");
}

export async function eliminarIngrediente(id: number): Promise<Ingrediente> {
    const response = await apiFetch(`${API_URL}/ingredientes/${id}`, {
        method: "DELETE",
    });

    return pedir<Ingrediente>(response, "Error al borrar el ingrediente");
}