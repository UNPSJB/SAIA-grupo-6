import type {
  Documento,
  DocumentoVigente,
  HistorialDocumento,
  TipoDocumento,
} from "../types/documento";

const API_URL = "http://localhost:8000";

// `detail` viene como string en los errores propios y como array en los 422 de validación.
function mensajeDeError(detail: unknown, porDefecto: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const mensajes = detail.map((d) => d?.msg).filter(Boolean);
    if (mensajes.length > 0) return mensajes.join(". ");
  }
  return porDefecto;
}

export function urlArchivo(archivoUrl: string): string {
  return `${API_URL}/${archivoUrl.replace(/\\/g, "/")}`;
}

// Gestión (administrador)
export async function listarDocumentos(): Promise<Documento[]> {
  const response = await fetch(`${API_URL}/documentos`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al obtener los documentos"));
  }
  return response.json();
}

export async function obtenerDocumento(id: number): Promise<Documento> {
  const response = await fetch(`${API_URL}/documentos/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al obtener el documento"));
  }
  return response.json();
}

// Historia 3: solo versiones vigentes, con búsqueda y filtro por tipo.
export async function listarDocumentosVigentes(
  buscar = "",
  tipo: TipoDocumento | "" = ""
): Promise<DocumentoVigente[]> {
  const params = new URLSearchParams();
  if (buscar.trim()) params.set("buscar", buscar.trim());
  if (tipo) params.set("tipo", tipo);
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${API_URL}/documentos/vigentes${query}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al obtener los documentos vigentes"));
  }
  return response.json();
}

// Historia 4: historial completo (el backend valida que el usuario sea administrador).
export async function obtenerHistorial(
  documentoId: number,
  usuarioId: number
): Promise<HistorialDocumento> {
  const response = await fetch(
    `${API_URL}/documentos/${documentoId}/historial?usuario_id=${usuarioId}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al obtener el historial"));
  }
  return response.json();
}

// Historias 1 y 2
export async function crearDocumento(datos: {
  nombre: string;
  tipo: TipoDocumento;
  autor_id: number;
  archivo: File;
}): Promise<Documento> {
  const formData = new FormData();
  formData.append("nombre", datos.nombre);
  formData.append("tipo", datos.tipo);
  formData.append("autor_id", String(datos.autor_id));
  formData.append("archivo", datos.archivo);

  const response = await fetch(`${API_URL}/documentos`, { method: "POST", body: formData });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al subir el documento"));
  }
  return response.json();
}

export async function subirNuevaVersion(
  documentoId: number,
  datos: { autor_id: number; archivo: File }
): Promise<Documento> {
  const formData = new FormData();
  formData.append("autor_id", String(datos.autor_id));
  formData.append("archivo", datos.archivo);

  const response = await fetch(`${API_URL}/documentos/${documentoId}/versiones`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(mensajeDeError(errorData?.detail, "Error al subir la nueva versión"));
  }
  return response.json();
}