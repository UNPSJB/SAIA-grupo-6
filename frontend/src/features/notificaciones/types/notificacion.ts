export type NivelNotificacion = "VENCIDO" | "PROXIMO_A_VENCER" | "STOCK_BAJO";

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
    switch (nivel) {
        case "VENCIDO":
            return "VENCIDO";
        case "PROXIMO_A_VENCER":
            return "PRÓXIMO A VENCER";
        case "STOCK_BAJO":
            return "STOCK BAJO";
    }
}


export type Criticidad = "alta" | "media" | "baja";

export type NivelRiesgo = "alto" | "medio" | "bajo";

export type IconoCriticidad =
  | "limpieza"
  | "calibracion"
  | "stock"
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
  fecha_referencia?: string;
  destino: string;
  recambio_id: number | null;
}

export interface CriticidadDashboard {
  nivel_riesgo: NivelRiesgo;
  total: number;
  altas: number;
  medias: number;
  bajas: number;
  alertas: AlertaCriticidad[];
}
