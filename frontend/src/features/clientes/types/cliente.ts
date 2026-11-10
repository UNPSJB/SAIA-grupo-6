export interface Cliente {
  id: number;
  nombre: string;
  documento: string;
  telefono: string;
  email: string | null;
  domicilio: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export type ClienteFormValues = Omit<Cliente, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;
