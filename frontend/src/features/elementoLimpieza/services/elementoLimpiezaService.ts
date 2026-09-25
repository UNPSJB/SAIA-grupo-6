import type { ElementoLimpieza } from "../types/elementoLimpieza";
import { ConflictoInactivoError } from "../../../common/api/errors";
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

  if (response.status === 409) {
    const errorData = await response.json().catch(() => null); 
    const detail = errorData?.detail; 
    if (detail && typeof detail === "object" && detail.tipo === "inactivo") { 
      throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo); 
    } 
  } 
  
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
  elemento: Partial<Omit<ElementoLimpieza, "id">>
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

export async function registrarRecambioElemento(id: number): Promise<ElementoLimpieza> {
  // ATENCIÓN: Esta es la ruta exacta que programaste en FastAPI
  const response = await fetch(`${API_URL}/elementos-limpieza/${id}/recambio`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Error al registrar el recambio del elemento"
    );
  }

  return response.json();
}