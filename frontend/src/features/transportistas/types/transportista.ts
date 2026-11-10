export interface Transportista {
  id: number;
  razon_social: string;
  cuit: string;
  telefono: string;
  email: string | null;
  domicilio: string | null;
  observaciones: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export type TransportistaFormValues = Omit<
  Transportista,
  "id" | "activo" | "fecha_creacion" | "fecha_actualizacion"
>;
