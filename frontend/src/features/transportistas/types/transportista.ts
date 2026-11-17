import type { EstadoHabilitacion } from "./certificacion";

export interface Transportista {
  id: number;
  razon_social: string;
  cuit: string;
  telefono: string;
  email: string | null;
  domicilio: string | null;
  observaciones: string | null;
  activo: boolean;
  estado_habilitacion: EstadoHabilitacion;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export type TransportistaFormValues = Omit<
  Transportista,
  | "id"
  | "activo"
  | "estado_habilitacion"
  | "fecha_creacion"
  | "fecha_actualizacion"
>;
