

export interface Persona {
  id: number;
  nombre: string;
  apellido?: string | null;
  dni: string;
  email: string;
  telefono?: string | null;
  puede_operar: boolean;
  puede_administrar: boolean;
  es_super_admin: boolean;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

/**
 * Lo que se puede enviar al backend al crear o editar.
 *
 * `password` vive acá y no en `Persona` porque es de solo ida: es un campo de
 * entrada que nunca vuelve en una respuesta. Tenerlo en `Persona` obligaba a
 * `PersonalForm` a castear dos veces para poder pasarlo.
 */
export interface PersonaInput {
  nombre: string;
  apellido?: string | null;
  dni: string;
  email: string;
  telefono?: string | null;
  password?: string | null;
  puede_operar?: boolean;
  puede_administrar?: boolean;
  es_super_admin?: boolean;
  activo?: boolean;
}


