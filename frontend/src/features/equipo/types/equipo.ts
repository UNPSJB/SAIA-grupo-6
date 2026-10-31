
import type { SectorResumen } from "../../sector/types/sector";

export interface Equipo {
  id: number;
  nombre: string;
  tipo: string;
  sector_id: number;
  sector: SectorResumen;
  activo: boolean;
  /** Cada cuántos días vence la calibración. Si viene null el backend usa 365. */
  frecuencia_calibracion_dias?: number | null;
}

export type TipoIntervencion = "calibracion" | "mantenimiento";

/** Una intervención registrada, tal como la devuelve el historial. */
export interface Calibracion {
  id: number;
  fecha_realizacion: string;
  proximo_vencimiento: string;
  /**
   * Ruta relativa dentro de la carpeta de uploads (ej: "uploads/certificados/x.pdf").
   * Se sirve por /uploads, que exige sesión: por eso hay que pedirla con
   * `apiFetchImagen` y no ponerla directo en un href.
   */
  certificado_url: string;
  tipo: TipoIntervencion;
}


export type EquipoInput = Omit<Equipo, "id" | "sector">;