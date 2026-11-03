/** Servicio de exportación de reportes.

Llama a los endpoints genéricos del backend:
  * GET /exportacion/tablas        -> lista de tablas y sus columnas
  * GET /exportacion/{tabla}?formato=csv|pdf&col=val -> descarga directa

No conoce tablas concretas: recibe el nombre de la tabla y los filtros como
clave-valor, y construye la URL dinámicamente.
*/

import { API_URL } from "../../../common/api/apiClient";
import { apiFetch } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { TablaExport, FormatoExport, FiltrosExport } from "../types/exportacion";

/** Devuelve todas las tablas que se pueden exportar, con sus columnas. */
export async function listarTablasExportables(): Promise<TablaExport[]> {
  const response = await apiFetch(`${API_URL}/exportacion/tablas`);
  return pedir<TablaExport[]>(response, "Error al obtener las tablas para exportar");
}

/** Devuelve las columnas (nombre + encabezado) de una tabla registrada. */
export async function obtenerColumnasTabla(nombreTabla: string): Promise<{ nombre: string; etiqueta: string }[]> {
  const response = await apiFetch(`${API_URL}/exportacion/${nombreTabla}/columnas`);
  return pedir<{ nombre: string; etiqueta: string }[]>(
    response,
    `Error al obtener columnas de ${nombreTabla}`
  );
}

/**
 * Descarga una tabla completa en CSV o PDF.
 *
 * `filtros` es un objeto { nombreColumna: valor } que se pasa como query
 * params al backend (filtro de igualdad por columna).
 */
export async function exportarTabla(
  nombreTabla: string,
  formato: FormatoExport,
  filtros: FiltrosExport = {}
): Promise<void> {
  const params = new URLSearchParams();
  params.set("formato", formato);

  for (const [columna, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "" && valor !== null) {
      params.set(columna, String(valor));
    }
  }

  const response = await apiFetch(
    `${API_URL}/exportacion/${nombreTabla}?${params.toString()}`
  );

  if (!response.ok) {
    const detalle = await response.json().catch(() => null);
    throw new Error(
      (detalle as { detail?: string })?.detail ||
      `Error al exportar ${nombreTabla}`
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const nombreArchivo = `${nombreTabla}_${new Date().toISOString().slice(0, 10)}.${formato}`;

  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
