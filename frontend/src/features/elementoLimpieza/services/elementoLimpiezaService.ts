import type { ElementoLimpieza, ElementoLimpiezaOpcion } from "../types/elementoLimpieza";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";


/**
 * Datos mínimos (id y nombre) para el selector del checklist.
 * Es el único listado de este módulo accesible a un operario sin permisos
 * de administración.
 */
export async function listarOpcionesElementosLimpieza(): Promise<ElementoLimpiezaOpcion[]> {
  const response = await apiFetch(`${API_URL}/elementos-limpieza/opciones`);

  return pedir<ElementoLimpiezaOpcion[]>(
    response,
    "Error al obtener los elementos de limpieza",
  );
}


export async function listarElementosLimpieza(
  page: number,
  pageSize: number,
  incluirInactivos = false
): Promise<Pagina<ElementoLimpieza>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: incluirInactivos || undefined,
  });
  const response = await apiFetch(`${API_URL}/elementos-limpieza${query}`);

  return pedir<Pagina<ElementoLimpieza>>(
    response,
    "Error al obtener los elementos de limpieza",
  );
}

export async function obtenerElementoLimpieza(
  id: number
): Promise<ElementoLimpieza> {
  const response = await apiFetch(`${API_URL}/elementos-limpieza/${id}`);

  return pedir<ElementoLimpieza>(
    response,
    "Error al obtener el elemento de limpieza",
  );
}

export async function crearElementoLimpieza(
  elemento: Omit<ElementoLimpieza, "id" | "activo">
): Promise<ElementoLimpieza> {
  const response = await apiFetch(`${API_URL}/elementos-limpieza`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(elemento),
  });

  return pedir<ElementoLimpieza>(
    response,
    "Error al crear el elemento de limpieza",
  );
}

export async function modificarElementoLimpieza(
  id: number,
  elemento: Partial<Omit<ElementoLimpieza, "id">>
): Promise<ElementoLimpieza> {
  const response = await apiFetch(`${API_URL}/elementos-limpieza/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(elemento),
  });

  return pedir<ElementoLimpieza>(
    response,
    "Error al modificar el elemento de limpieza",
  );
}

export async function darDeBajaElementoLimpieza(
  id: number
): Promise<ElementoLimpieza> {
  const response = await apiFetch(`${API_URL}/elementos-limpieza/${id}`, {
    method: "DELETE",
  });

  return pedir<ElementoLimpieza>(
    response,
    "Error al dar de baja el elemento de limpieza",
  );
}

export async function registrarRecambioElemento(id: number): Promise<ElementoLimpieza> {
  // ATENCIÓN: Esta es la ruta exacta que programaste en FastAPI
  const response = await apiFetch(`${API_URL}/elementos-limpieza/${id}/recambio`, {
    method: "POST",
  });

  return pedir<ElementoLimpieza>(
    response,
    "Error al registrar el recambio del elemento",
  );
}