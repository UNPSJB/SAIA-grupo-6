import type { ElementoLimpieza } from "../types/elementoLimpieza";

const API_URL = "http://localhost:8000";

export async function listarElementosLimpieza(
  incluirInactivos = false
): Promise<ElementoLimpieza[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await fetch(`${API_URL}/elementos-limpieza${query}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al obtener los elementos de limpieza"
    );
  }

  return response.json();
}

export async function obtenerElementoLimpieza(
  id: number
): Promise<ElementoLimpieza> {
  const response = await fetch(`${API_URL}/elementos-limpieza/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al obtener el elemento de limpieza"
    );
  }

  return response.json();
}

export async function crearElementoLimpieza(
  elemento: Omit<ElementoLimpieza, "id" | "activo">
): Promise<ElementoLimpieza> {
  const response = await fetch(`${API_URL}/elementos-limpieza`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(elemento),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al crear el elemento de limpieza"
    );
  }

  return response.json();
}

export async function modificarElementoLimpieza(
  id: number,
  elemento: Partial<Omit<ElementoLimpieza, "id" | "activo">>
): Promise<ElementoLimpieza> {
  const response = await fetch(`${API_URL}/elementos-limpieza/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(elemento),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al modificar el elemento de limpieza"
    );
  }

  return response.json();
}

export async function darDeBajaElementoLimpieza(
  id: number
): Promise<ElementoLimpieza> {
  const response = await fetch(`${API_URL}/elementos-limpieza/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al dar de baja el elemento de limpieza"
    );
  }

  return response.json();
}