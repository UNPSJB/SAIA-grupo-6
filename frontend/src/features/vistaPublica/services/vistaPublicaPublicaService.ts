const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
