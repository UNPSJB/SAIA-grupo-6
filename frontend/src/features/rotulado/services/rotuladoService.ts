import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  AutocompletarIn,
  BorradorRotuladoCreate,
  BorradorRotuladoOut,
  BorradorRotuladoUpdate,
  CampoEditadoOut,
  PrevisualizacionRotulado,
  VistaPreviaAutocompletado,
} from "../types/rotulado";

const BASE = `${API_URL}/rotulado`;

export async function listarBorradoresPorProducto(
  productoId: number,
): Promise<BorradorRotuladoOut[]> {
  const response = await apiFetch(
    `${BASE}/productos/${productoId}/borradores`,
  );
  return pedir<BorradorRotuladoOut[]>(
    response,
    "Error al obtener los borradores del producto",
  );
}

export async function crearBorrador(
  datos: BorradorRotuladoCreate,
): Promise<BorradorRotuladoOut> {
  const response = await apiFetch(`${BASE}/productos/${datos.producto_id}/borradores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<BorradorRotuladoOut>(
    response,
    "Error al crear el borrador",
  );
}

export async function obtenerBorrador(
  borradorId: number,
): Promise<BorradorRotuladoOut> {
  const response = await apiFetch(`${BASE}/borradores/${borradorId}`);
  return pedir<BorradorRotuladoOut>(
    response,
    "Error al obtener el borrador",
  );
}

export async function actualizarBorrador(
  borradorId: number,
  datos: BorradorRotuladoUpdate,
): Promise<BorradorRotuladoOut> {
  const response = await apiFetch(`${BASE}/borradores/${borradorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<BorradorRotuladoOut>(
    response,
    "Error al actualizar el borrador",
  );
}

export async function eliminarBorrador(borradorId: number): Promise<void> {
  const response = await apiFetch(`${BASE}/borradores/${borradorId}`, {
    method: "DELETE",
  });
  return pedir<void>(response, "Error al eliminar el borrador");
}

export async function autocompletarBorrador(
  borradorId: number,
  datos: AutocompletarIn,
): Promise<BorradorRotuladoOut> {
  const response = await apiFetch(`${BASE}/borradores/${borradorId}/autocompletar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<BorradorRotuladoOut>(
    response,
    "Error al autocompletar el borrador",
  );
}

export async function consultarHistorialEdiciones(
  borradorId: number,
): Promise<CampoEditadoOut[]> {
  const response = await apiFetch(
    `${BASE}/borradores/${borradorId}/historial-ediciones`,
  );
  return pedir<CampoEditadoOut[]>(
    response,
    "Error al obtener el historial de ediciones",
  );
}

export async function previewAutocompletado(
  productoId: number,
  versionId: number | null = null,
): Promise<VistaPreviaAutocompletado> {
  const params = new URLSearchParams();
  if (versionId !== null && versionId !== undefined) {
    params.set("version_id", String(versionId));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(
    `${BASE}/productos/${productoId}/autocompletar/preview${query}`,
  );
  return pedir<VistaPreviaAutocompletado>(
    response,
    "Error al obtener la vista previa de autocompletado",
  );
}

export async function previsualizarBorrador(id: number, signal: AbortSignal) {
  const response = await apiFetch(`${BASE}/borradores/${id}/previsualizacion`, { signal });
  try {
    return await pedir<PrevisualizacionRotulado>(response, "Error al previsualizar el borrador");
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { status: response.status });
  }
}

export async function recalcularNutricionBorrador(id: number) {
  const response = await apiFetch(`${BASE}/borradores/${id}/nutricion/recalcular`, {
    method: "POST",
  });
  return pedir<BorradorRotuladoOut>(response, "Error al recalcular la tabla nutricional");
}


export async function exportarBorradorPdf(id: number) {
  const response = await apiFetch(`${BASE}/borradores/${id}/exportar-pdf`, { method: "POST" });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: unknown } | null;
    throw new Error(typeof error?.detail === "string" ? error.detail : "No se pudo exportar el borrador.");
  }

  const url = URL.createObjectURL(await response.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `borrador-rotulo-${id}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
