export interface Notificacion { 
    id_notificacion: string; 
    tipo: string; 
    entidad_id: number; 
    titulo: string; 
    mensaje: string; 
    nivel: "VENCIDO" | "PROXIMO_A_VENCER";
    link_destino: string; 
    fecha_referencia?: string; }