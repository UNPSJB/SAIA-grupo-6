export interface Sector {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

/** Versión mínima que el backend incrusta en cada equipo. */
export interface SectorResumen {
  id: number;
  nombre: string;
}

export type SectorFormValues = Omit<Sector, "id" | "activo">;