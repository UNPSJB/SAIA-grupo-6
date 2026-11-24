import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  Composicion,
  IngredienteOpcion,
  ModoEscalado,
  Receta,
  RecetaEscalada,
  RecetaCreateInput,
  VersionDetalle,
  VersionInput,
  VersionResumen,
} from "../types/receta";

export async function listarRecetas(incluirInactivas = false): Promise<Receta[]> {
  const query = incluirInactivas ? "?incluir_inactivas=true" : "";
  const response = await apiFetch(`${API_URL}/recetas${query}`);
  return pedir<Receta[]>(response, "Error al obtener las recetas");
}

export async function obtenerReceta(id: number): Promise<Receta> {
  const response = await apiFetch(`${API_URL}/recetas/${id}`);
  return pedir<Receta>(response, "Error al obtener la receta");
}

export async function listarVersiones(recetaId: number): Promise<VersionResumen[]> {
  const response = await apiFetch(`${API_URL}/recetas/${recetaId}/versiones`);
  return pedir<VersionResumen[]>(response, "Error al obtener las versiones de la receta");
}

export async function obtenerVersion(versionId: number): Promise<VersionDetalle> {
  const response = await apiFetch(`${API_URL}/recetas/versiones/${versionId}`);
  return pedir<VersionDetalle>(response, "Error al obtener la versión de la receta");
}

export async function crearReceta(datos: RecetaCreateInput): Promise<Receta> {
  const response = await apiFetch(`${API_URL}/recetas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<Receta>(response, "Error al crear la receta");
}

export async function crearVersion(
  recetaId: number,
  datos: VersionInput,
): Promise<VersionDetalle> {
  const response = await apiFetch(`${API_URL}/recetas/${recetaId}/versiones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<VersionDetalle>(response, "Error al guardar la nueva versión");
}

/** Vista de cálculo de la versión vigente. No modifica la receta guardada. */
export async function escalarReceta(
  recetaId: number,
  modo: ModoEscalado,
  valor: string,
): Promise<RecetaEscalada> {
  const parametro = modo === "factor" ? "factor" : "cantidad_objetivo";
  const response = await apiFetch(
    `${API_URL}/recetas/${recetaId}/escalado?${parametro}=${encodeURIComponent(valor)}`,
  );
  return pedir<RecetaEscalada>(response, "Error al escalar la receta");
}

/** Ingredientes activos (ingredientes y aditivos) para armar la receta. */
export async function listarIngredientesParaReceta(): Promise<IngredienteOpcion[]> {
  const response = await apiFetch(`${API_URL}/ingredientes`);
  return pedir<IngredienteOpcion[]>(response, "Error al obtener los ingredientes");
}


export async function obtenerComposicion(versionId: number): Promise<Composicion> {
  const response = await apiFetch(`${API_URL}/recetas/versiones/${versionId}/composicion`);
  return pedir<Composicion>(response, "Error al obtener la composición porcentual");
}


/** Fija el orden de un grupo de ingredientes que pesan lo mismo (del primero al último). */
export async function decidirOrdenEmpate(
  versionId: number,
  ingredienteIds: number[],
): Promise<Composicion> {
  const response = await apiFetch(`${API_URL}/recetas/versiones/${versionId}/orden-empate`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingrediente_ids: ingredienteIds }),
  });
  return pedir<Composicion>(response, "Error al guardar el orden de la lista");
}