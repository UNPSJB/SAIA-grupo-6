export type TipoIncidente =
  | "plagas"
  | "falla_equipo"
  | "devolucion_cliente"
  | "higiene_contaminacion"
  | "otro";

/**
 * Estado del incidente. Se abre al reportarlo y lo cierra el administrador
 * cuando resuelve, dejando asentada la acción correctiva.
 */
export type EstadoIncidente = "abierto" | "cerrado";

export interface Incidente {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
  equipo_nombre: string | null;
  foto_url: string | null;
  usuario_id: number;
  usuario_nombre: string | null;
  fecha_reporte: string;
  estado: EstadoIncidente;
  fecha_cierre: string | null;
  observacion_cierre: string | null;
  responsable_cierre_id: number | null;
  responsable_cierre_nombre: string | null;
}

export type IncidenteFormValues = {
  titulo: string;
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
};

export const TIPOS_INCIDENTE: { value: TipoIncidente; label: string }[] = [
  { value: "plagas", label: "Plagas" },
  { value: "falla_equipo", label: "Falla / Rotura de Equipo" },
  { value: "devolucion_cliente", label: "Devolución de Cliente" },
  { value: "higiene_contaminacion", label: "Higiene / Contaminación" },
  { value: "otro", label: "Otro" },
];

// Tipos donde tiene sentido asociar un equipo concreto. Para el resto el
// equipo queda en null y el detalle se describe en la descripción libre.
export const TIPOS_CON_EQUIPO: TipoIncidente[] = [
  "falla_equipo",
  "higiene_contaminacion",
];

export function admiteEquipo(tipo: TipoIncidente): boolean {
  return TIPOS_CON_EQUIPO.includes(tipo);
}

// Tipos donde el equipo es obligatorio. Para higiene_contaminacion el equipo
// es opcional (no siempre se contamina un equipo).
export const TIPOS_EQUIPO_OBLIGATORIO: TipoIncidente[] = ["falla_equipo"];

export function requiereEquipoObligatorio(tipo: TipoIncidente): boolean {
  return TIPOS_EQUIPO_OBLIGATORIO.includes(tipo);
}

export const ESTADOS_INCIDENTE: { value: EstadoIncidente; label: string }[] = [
  { value: "abierto", label: "Abierto" },
  { value: "cerrado", label: "Cerrado" },
];

export function estadoLabel(estado: EstadoIncidente): string {
  return ESTADOS_INCIDENTE.find((e) => e.value === estado)?.label ?? estado;
}

// --- Helpers de presentación ---
//
// Viven acá y no en cada componente porque el tipo, el estado y el formato de
// fecha se muestran en el listado, en el detalle y en los reportes del
// operador: si cada uno define el suyo, quedan desincronizados.

export function tipoLabel(tipo: TipoIncidente): string {
  return TIPOS_INCIDENTE.find((t) => t.value === tipo)?.label ?? tipo;
}

/** Paleta del badge de tipo, para que el color signifique lo mismo en todas las vistas. */
export function tipoColor(tipo: TipoIncidente): string {
  switch (tipo) {
    case "plagas": return "red";
    case "falla_equipo": return "orange";
    case "devolucion_cliente": return "yellow";
    case "higiene_contaminacion": return "purple";
    default: return "gray";
  }
}

const FECHA_AR = {
  timeZone: "America/Argentina/Buenos_Aires",
  hour12: false,
} as const;

export function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", FECHA_AR);
}

export function formatoFechaCierre(fecha: string | null): string {
  return fecha ? formatoFecha(fecha) : "-";
}

// --- Historial de incidente ---

export interface HistorialIncidenteItem {
  id: number;
  estado_anterior: string;
  estado_nuevo: string;
  usuario_id: number;
  usuario_nombre: string | null;
  observacion: string | null;
  fecha_evento: string;
}

export interface HistorialIncidenteResponse {
  incidente_id: number;
  eventos: HistorialIncidenteItem[];
}
