

export interface Persona {
  id: number;
  nombre: string;
  apellido?: string | null;
  dni: string;
  email: string;
  telefono?: string | null;
  password?: string; //
  puede_operar: boolean;
  puede_administrar: boolean;
  es_super_admin?: boolean;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
}


