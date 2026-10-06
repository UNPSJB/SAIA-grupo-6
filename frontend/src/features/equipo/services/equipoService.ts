import type { Calibracion, Equipo } from "../types/equipo";

import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function listarEquipos(incluirInactivos = false): Promise<Equipo[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/equipos${query}`);

  return pedir<Equipo[]>(response, "Error al obtener los equipos");
}

export async function obtenerEquipo(id: number): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`);

  return pedir<Equipo>(response, "Error al obtener el equipo");
}

export async function crearEquipo(
  equipo: Omit<Equipo, "id">
): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  return pedir<Equipo>(response, "Error al crear el equipo");
}


export async function modificarEquipo(
  id: number,
  equipo: Omit<Equipo, "id">
): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  return pedir<Equipo>(response, "Error al modificar el equipo");
}

export async function eliminarEquipo(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "DELETE",
  });

  return pedir<void>(response, "Error al eliminar el equipo");
}

export async function reactivarEquipo(id: number, equipo: Omit<Equipo, "id">): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...equipo, activo: true }),
  });
  return pedir<Equipo>(response, "Error al reactivar el equipo");
}

export async function registrarCalibracion(
  equipoId: number,
  fechaRealizacion: string,
  certificado: File
): Promise<Calibracion> {
  const formData = new FormData();
  formData.append("fecha_realizacion", fechaRealizacion);
  formData.append("certificado", certificado);

  // Sin `Content-Type`: el browser tiene que poner el boundary del multipart.
  const response = await apiFetch(`${API_URL}/equipos/${equipoId}/calibraciones`, {
    method: "POST",
    body: formData,
  });

  return pedir<Calibracion>(response, "Error al registrar la calibración");
}

export async function obtenerHistorialCalibraciones(
  equipoId: number
): Promise<Calibracion[]> {
  const response = await apiFetch(`${API_URL}/equipos/${equipoId}/calibraciones`);

  return pedir<Calibracion[]>(
    response,
    "Error al obtener el historial de calibraciones"
  );
}