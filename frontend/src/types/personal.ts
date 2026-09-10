export interface Persona {
  id: number;
  nombre: string;
  apellido?: string | null;
  dni: string;
  email: string;
  telefono?: string | null;
  puede_operar: boolean;
  puede_administrar: boolean;
  activo: boolean;
}