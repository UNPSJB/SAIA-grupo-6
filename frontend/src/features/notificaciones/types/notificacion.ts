
export type NivelNotificacion = "VENCIDO" | "PROXIMO_A_VENCER";

export interface Notificacion { 
    id_notificacion: string; 
    tipo: string; 
    entidad_id: number; 
    titulo: string; 
    mensaje: string; 
    nivel: NivelNotificacion;
    link_destino: string; 
    fecha_referencia?: string; }

/**
 * Etiqueta del nivel de la alerta.
 *
 * Vive acá y no en cada vista: el centro de notificaciones y el panel de
 * inicio muestran las mismas alertas y cada uno con su propio texto
 * terminaba diciendo una cosa distinta.
 */
export function nivelLabel(nivel: NivelNotificacion): string {
    return nivel === "VENCIDO" ? "VENCIDO" : "PRÓXIMO A VENCER";
}


export type Criticidad = "alta" | "media" | "baja";

export type NivelGeneralCriticidad = "alto" | "medio" | "bajo";

export type IconoCriticidad =
  | "limpieza"
  | "calibracion"
  | "incidente"
  | "personal"
  | "documento"
  | "checklist";

export interface AlertaCriticidad {
  clave: string;
  origen: string;
  entidad_id: number;
  grupo_clave: string;
  icono: IconoCriticidad;
  titulo: string;
  detalle: string;
  criticidad: Criticidad;
  motivo: string;
  plazo: string;
  destino: string;
  recambio_id: number | null;
}

export interface CriticidadDashboard {
  nivel_general: NivelGeneralCriticidad;
  total: number;
  altas: number;
  medias: number;
  bajas: number;
  alertas: AlertaCriticidad[];
}
