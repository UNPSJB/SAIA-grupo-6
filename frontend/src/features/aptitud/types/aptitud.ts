export interface Aptitud {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

export type AptitudFormValues = Omit<Aptitud, "id" | "activo">;