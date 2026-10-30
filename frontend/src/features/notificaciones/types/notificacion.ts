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
