export interface Establecimiento {
  id: number;
  nombre: string;
  direccion?: string | null;
  /** Nombre legal del elaborador (va en el rótulo). */
  razon_social?: string | null;
  activo: boolean;
  fecha_creacion: string;
  /** Personal activo de la sede. */
  personal_activo: number;
}

export interface EstablecimientoInput {
  nombre?: string;
  direccion?: string | null;
  /** Nombre legal del elaborador (va en el rótulo). */
  razon_social?: string | null;
  activo?: boolean;
}
