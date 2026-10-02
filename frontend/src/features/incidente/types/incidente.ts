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
