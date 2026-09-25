import type { Notificacion } from "../types/notificacion";

const API_URL = "http://localhost:8000";

export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await fetch(`${API_URL}/notificaciones`);
  if (!response.ok) {
    throw new Error("Error al obtener las notificaciones del sistema");
  }
  return response.json();
}