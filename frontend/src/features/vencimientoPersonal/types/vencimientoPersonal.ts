export interface VencimientoPersonal {
  id: number;
  persona_id: number;
  aptitud_id: number;
  fecha_vencimiento: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
}

export interface VencimientoPersonalCreate {
  persona_id: number;
  aptitud_id: number;
  fecha_vencimiento: string;
}

export interface VencimientoPersonalUpdate {
  fecha_vencimiento: string;
}