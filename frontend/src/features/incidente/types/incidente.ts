export type TipoIncidente =
  | "plagas"
  | "falla_equipo"
  | "devolucion_cliente"
  | "higiene_contaminacion"
  | "otro";

export interface Incidente {
  id: number;
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
  equipo_nombre: string | null;
  foto_url: string | null;
  usuario_id: number;
  usuario_nombre: string | null;
  fecha_reporte: string;
  activo: boolean;
}

export type IncidenteFormValues = {
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
  foto_url: string | null;
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
