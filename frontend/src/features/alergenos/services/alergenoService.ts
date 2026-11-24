import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  Alergeno,
  AlergenosDeIngrediente,
  AlergenosDeProducto,
  AlergenosDeIngredienteInput,
} from "../types/alergeno";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listarAlergenos(incluirInactivos = false): Promise<Alergeno[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/alergenos${query}`);
  return pedir<Alergeno[]>(response, "No se pudieron cargar los alérgenos");
}

export async function crearAlergeno(nombre: string): Promise<Alergeno> {
  const response = await apiFetch(`${API_URL}/alergenos`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ nombre }),
  });
  return pedir<Alergeno>(response, "No se pudo crear el alérgeno");
}

export async function modificarAlergeno(
  id: number,
  cambios: { nombre?: string; activo?: boolean }
): Promise<Alergeno> {
  const response = await apiFetch(`${API_URL}/alergenos/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(cambios),
  });
  return pedir<Alergeno>(response, "No se pudo modificar el alérgeno");
}

export async function darDeBajaAlergeno(id: number): Promise<Alergeno> {
  const response = await apiFetch(`${API_URL}/alergenos/${id}`, { method: "DELETE" });
  return pedir<Alergeno>(response, "No se pudo dar de baja el alérgeno");
}

export async function obtenerAlergenosDeIngrediente(ingredienteId: number): Promise<AlergenosDeIngrediente> {
  const response = await apiFetch(`${API_URL}/alergenos/ingredientes/${ingredienteId}`);
  return pedir<AlergenosDeIngrediente>(response, "No se pudieron cargar los alérgenos del ingrediente");
}

export async function guardarAlergenosDeIngrediente(
  ingredienteId: number,
  datos: AlergenosDeIngredienteInput
): Promise<AlergenosDeIngrediente> {
  const response = await apiFetch(`${API_URL}/alergenos/ingredientes/${ingredienteId}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<AlergenosDeIngrediente>(response, "No se pudieron guardar los alérgenos");
}

export async function obtenerAlergenosDeProducto(productoId: number): Promise<AlergenosDeProducto> {
  const response = await apiFetch(`${API_URL}/alergenos/productos/${productoId}`);
  return pedir<AlergenosDeProducto>(response, "No se pudieron cargar los alérgenos del producto");
}
