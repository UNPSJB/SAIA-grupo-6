import type { Equipo } from "../types/equipo";

const API_URL = "http://localhost:8000";

export async function listarEquipos(): Promise<Equipo[]> {
  const response = await fetch(`${API_URL}/equipos`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener los equipos");
  }

  return response.json();
}

export async function obtenerEquipo(id: number): Promise<Equipo> {
  const response = await fetch(`${API_URL}/equipos/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el equipo");
  }

  return response.json();
}

export async function crearEquipo(
  equipo: Omit<Equipo, "id">
): Promise<Equipo> {
  const response = await fetch(`${API_URL}/equipos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al crear el equipo");
  }

  return response.json();
}



export async function modificarEquipo(
  id: number,
  equipo: Omit<Equipo, "id">
): Promise<Equipo> {
  const response = await fetch(`${API_URL}/equipos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al modificar el equipo");
  }

  return response.json();
}

export async function eliminarEquipo(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/equipos/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar el equipo");
  }
}