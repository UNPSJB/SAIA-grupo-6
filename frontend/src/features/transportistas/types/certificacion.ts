export type EstadoCertificacion =
  | "Vigente"
  | "Vencida"
  | "Reemplazada"
  | "Anulada";

export type EstadoHabilitacion =
  | "Habilitado"
  | "Certificación vencida"
  | "Sin certificaciones";

export interface CertificacionTransportista {
  id: number;
  transportista_id: number;
  tipo: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  observaciones: string | null;
  archivo_url: string | null;
  activa: boolean;
  estado: EstadoCertificacion;
  anulada: boolean;
  motivo_anulacion: string | null;
  anulada_por: number | null;
  fecha_anulacion: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export type CertificacionFormValues = {
  tipo: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  observaciones: string;
};

/** Sugerencias para el input libre de tipo (el usuario puede escribir otro). */
export const SUGERENCIAS_TIPO_CERTIFICACION = [
  "SENASA",
  "Habilitación Municipal",
  "Desinfección",
  "Seguro",
];

/**
 * Misma normalización que aplica el backend para `tipo_normalizado`:
 * recorta, colapsa espacios, pasa a minúsculas y quita tildes.
 */
export function normalizarTipo(tipo: string): string {
  return tipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
