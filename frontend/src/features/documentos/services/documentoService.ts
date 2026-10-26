import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type {
  Documento,
  DocumentoVigente,
  HistorialDocumento,
  TipoDocumento,
} from "../types/documento";

export function urlArchivo(archivoUrl: string): string {
  return `${API_URL}/${archivoUrl.replace(/\\/g, "/")}`;
}

// Gestión (administrador): la tabla pide de a una página.
export async function listarDocumentos(
  page: number,
  pageSize: number
): Promise<Pagina<Documento>> {
  const query = queryPagina(page, pageSize);
  const response = await apiFetch(`${API_URL}/documentos${query}`);
  return pedir<Pagina<Documento>>(response, "Error al obtener los documentos");
}

export async function obtenerDocumento(id: number): Promise<Documento> {
  const response = await apiFetch(`${API_URL}/documentos/${id}`);
  return pedir<Documento>(response, "Error al obtener el documento");
}

// Historia 3: solo versiones vigentes, con búsqueda y filtro por tipo,
// aplicados en el servidor junto con la paginación.
export async function listarDocumentosVigentes(
  page: number,
  pageSize: number,
  buscar = "",
  tipo: TipoDocumento | "" = ""
): Promise<Pagina<DocumentoVigente>> {
  const query = queryPagina(page, pageSize, {
    buscar: buscar.trim() || undefined,
    tipo: tipo || undefined,
  });

  const response = await apiFetch(`${API_URL}/documentos/vigentes${query}`);
  return pedir<Pagina<DocumentoVigente>>(
    response,
    "Error al obtener los documentos vigentes"
  );
}

// Historia 4: historial completo. La ruta es admin-only y el backend verifica
// el permiso contra el usuario del TOKEN: el cliente ya no envía usuario_id
// (antes era un query param controlado por el cliente).
export async function obtenerHistorial(
  documentoId: number
): Promise<HistorialDocumento> {
  const response = await apiFetch(
    `${API_URL}/documentos/${documentoId}/historial`
  );
  return pedir<HistorialDocumento>(
    response,
    "Error al obtener el historial"
  );
}


export async function crearDocumento(datos: {
  nombre: string;
  tipo: TipoDocumento;
  autor_id: number;
  archivo: File;
  fecha_vencimiento: string | null;
}): Promise<Documento> {
  const formData = new FormData();

  formData.append("nombre", datos.nombre);
  formData.append("tipo", datos.tipo);
  formData.append("autor_id", String(datos.autor_id));
  formData.append("archivo", datos.archivo);

  if (datos.fecha_vencimiento) {
    formData.append("fecha_vencimiento", datos.fecha_vencimiento);
  }

  const response = await apiFetch(`${API_URL}/documentos`, {
    method: "POST",
    body: formData,
  });

  return pedir<Documento>(response, "Error al subir el documento");
}

export async function subirNuevaVersion(
  documentoId: number,
  datos: {
    autor_id: number;
    archivo: File;
    fecha_vencimiento: string | null;
  }
): Promise<Documento> {
  const formData = new FormData();

  formData.append("autor_id", String(datos.autor_id));
  formData.append("archivo", datos.archivo);

  if (datos.fecha_vencimiento) {
    formData.append("fecha_vencimiento", datos.fecha_vencimiento);
  }

  const response = await apiFetch(
    `${API_URL}/documentos/${documentoId}/versiones`,
    {
      method: "POST",
      body: formData,
    }
  );

  return pedir<Documento>(
    response,
    "Error al subir la nueva versión"
  );
}

export async function abrirArchivo(archivoUrl: string): Promise<void> {
  const ventana = window.open("", "_blank");

  try {
    const response = await apiFetch(urlArchivo(archivoUrl));
    if (!response.ok) throw new Error("No se pudo abrir el documento");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (ventana) {
      ventana.location.href = objectUrl;
    } else {
      window.location.href = objectUrl; // popup bloqueado: fallback
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}