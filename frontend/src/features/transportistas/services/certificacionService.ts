import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { CertificacionTransportista } from "../types/certificacion";

export async function listarCertificaciones(
  transportistaId: number,
  incluirHistorial = false,
): Promise<CertificacionTransportista[]> {
  const params = new URLSearchParams();
  if (incluirHistorial) params.set("incluir_historial", "true");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(
    `${API_URL}/transportistas/${transportistaId}/certificaciones${query}`,
  );
  return pedir<CertificacionTransportista[]>(
    response,
    "Error al obtener las certificaciones",
  );
}

export async function crearCertificacion(
  transportistaId: number,
  formData: FormData,
): Promise<CertificacionTransportista> {
  // Sin `Content-Type`: el navegador tiene que armar el boundary del multipart.
  const response = await apiFetch(
    `${API_URL}/transportistas/${transportistaId}/certificaciones`,
    {
      method: "POST",
      body: formData,
    },
  );
  return pedir<CertificacionTransportista>(
    response,
    "Error al crear la certificación",
  );
}

/** Solo se pueden modificar las observaciones: tipo y fechas son inmutables. */
export async function modificarCertificacion(
  id: number,
  datos: { observaciones?: string | null },
): Promise<CertificacionTransportista> {
  const response = await apiFetch(
    `${API_URL}/transportistas/certificaciones/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    },
  );
  return pedir<CertificacionTransportista>(
    response,
    "Error al modificar la certificación",
  );
}

export async function reemplazarArchivoCertificacion(
  id: number,
  archivo: File,
): Promise<CertificacionTransportista> {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const response = await apiFetch(
    `${API_URL}/transportistas/certificaciones/${id}/archivo`,
    { method: "PUT", body: formData },
  );
  return pedir<CertificacionTransportista>(
    response,
    "Error al reemplazar el comprobante",
  );
}

export async function anularCertificacion(
  id: number,
  motivo: string,
): Promise<CertificacionTransportista> {
  const response = await apiFetch(
    `${API_URL}/transportistas/certificaciones/${id}/anular`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    },
  );
  return pedir<CertificacionTransportista>(
    response,
    "Error al anular la certificación",
  );
}

/** Nombre con el que se guarda el comprobante: el original, o uno genérico. */
function nombreDeArchivo(
  archivoUrl: string | null | undefined,
  id: number,
): string {
  const base = archivoUrl?.split("/").pop()?.trim();
  return base ? base : `certificacion_${id}`;
}

async function obtenerArchivo(id: number): Promise<Blob> {
  const response = await apiFetch(
    `${API_URL}/transportistas/certificaciones/${id}/archivo`,
  );
  if (!response.ok) {
    throw new Error("No se pudo obtener el comprobante adjunto.");
  }
  return response.blob();
}

/** Descarga el comprobante conservando el nombre original del archivo. */
export async function descargarArchivoCertificacion(
  id: number,
  archivoUrl?: string | null,
): Promise<void> {
  const blob = await obtenerArchivo(id);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDeArchivo(archivoUrl, id);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

/** Abre el comprobante en una pestaña nueva para visualizarlo. */
export async function verArchivoCertificacion(id: number): Promise<void> {
  const blob = await obtenerArchivo(id);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Se libera más tarde: si se revoca en el acto, la pestaña nueva queda en blanco.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
