import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  AutocompletarIn,
  BorradorRotuladoCreate,
  BorradorRotuladoOut,
  BorradorRotuladoUpdate,
  CampoEditadoOut,
  CompletitudRotulado,
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

export async function consultarCompletitud(
  borradorId: number,
): Promise<CompletitudRotulado> {
  const response = await apiFetch(`${BASE}/borradores/${borradorId}/completitud`);
  return pedir<CompletitudRotulado>(
    response,
    "Error al consultar la completitud",
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
