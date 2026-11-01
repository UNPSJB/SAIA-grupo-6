import type { IndicadorPublico } from "../types/vistaPublica";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * El enlace dejó de ser válido: la vista se desactivó, se regeneró el código
 * o nunca existió. La página lo trata igual que una validación fallida.
 */
export class VistaPublicaNoDisponibleError extends Error {
  constructor() {
    super("Esta vista pública no está disponible.");
    this.name = "VistaPublicaNoDisponibleError";
  }
}

/**
 * Cliente anónimo a propósito: no adjunta JWT, no intenta refresh y nunca
 * redirige al login. La respuesta no contiene indicadores ni datos internos.
 */
export async function validarVistaPublica(codigoPublico: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/vista-publica/publica/${encodeURIComponent(codigoPublico)}/validar`,
      { cache: "no-store" },
    );
  } catch {
    throw new Error("No se pudo conectar con el servidor para validar el enlace.");
  }

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error("No se pudo validar el enlace público.");
  }

  const datos = (await response.json().catch(() => null)) as { valida?: unknown } | null;
  if (datos?.valida !== true) {
    throw new Error("El servidor devolvió una respuesta de validación inválida.");
  }

  return true;
}

/**
 * Indicadores agregados y positivos del enlace público. Solo devuelve lo que
 * el administrador habilitó; el backend calcula el porcentaje en cada request
 * y responde `no-store`, así un cambio se ve en la próxima consulta.
 */
export async function obtenerIndicadoresPublicos(
  codigoPublico: string,
): Promise<IndicadorPublico[]> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/vista-publica/publica/${encodeURIComponent(codigoPublico)}/indicadores`,
      { cache: "no-store" },
    );
  } catch {
    throw new Error("No se pudo conectar con el servidor para cargar los indicadores.");
  }

  if (response.status === 404) {
    throw new VistaPublicaNoDisponibleError();
  }
  if (!response.ok) {
    throw new Error("No se pudieron cargar los indicadores públicos.");
  }

  const datos = (await response.json().catch(() => null)) as
    | { indicadores?: unknown }
    | null;
  if (!Array.isArray(datos?.indicadores)) {
    throw new Error("El servidor devolvió una respuesta de indicadores inválida.");
  }

  return datos.indicadores as IndicadorPublico[];
}
