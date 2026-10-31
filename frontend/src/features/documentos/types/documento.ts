export type TipoDocumento =
  | "manual_bpm"
  | "ficha_tecnica"
  | "procedimiento"
  | "receta";

export const TIPOS_DOCUMENTO: { value: TipoDocumento; label: string }[] = [
  { value: "manual_bpm", label: "Manual de BPM" },
  { value: "ficha_tecnica", label: "Ficha técnica" },
  { value: "procedimiento", label: "Procedimiento" },
  { value: "receta", label: "Receta" },
];

export type EstadoVersion = "vigente" | "vencido" | "archivado";

/**
 * Estado que se puede filtrar en los listados de documentos. Es un
 * subconjunto de `EstadoVersion`: "archivado" describe una versión, no un
 * documento.
 */
export type EstadoDocumentoFiltro = "vigente" | "vencido";

export const ESTADOS_DOCUMENTO: {
  value: EstadoDocumentoFiltro;
  label: string;
}[] = [
  { value: "vigente", label: "Vigente" },
  { value: "vencido", label: "Vencido" },
];

export interface AutorVersion {
  id: number;
  nombre: string;
  apellido: string | null;
}

export interface VersionDocumento {
  id: number;
  numero_version: number;
  nombre_archivo: string;
  archivo_url: string;
  estado: EstadoVersion;
  vigente_desde: string;
  vigente_hasta: string | null;
  fecha_vencimiento: string | null;
  fecha_subida: string;
  autor: AutorVersion;
}

// Vista de gestión (administrador): la vigente + un resumen.
export interface Documento {
  id: number;
  nombre: string;
  tipo: TipoDocumento;
  fecha_creacion: string;
  version_vigente: VersionDocumento | null;
  cantidad_archivadas: number;
  proximo_numero_version: number;
}

// Vista de consulta (operador): solo la versión vigente.
export interface DocumentoVigente {
  id: number;
  nombre: string;
  tipo: TipoDocumento;
  version_vigente: VersionDocumento;
}

// Vista de historial (administrador): todas las versiones, de la más nueva a la más vieja.
export interface HistorialDocumento {
  id: number;
  nombre: string;
  tipo: TipoDocumento;
  versiones: VersionDocumento[];
}

// El número de versión no se carga: lo calcula el backend.
export interface DocumentoFormValues {
  nombre: string;
  tipo: TipoDocumento;
  archivo: File | null;
  fecha_vencimiento: string;
}