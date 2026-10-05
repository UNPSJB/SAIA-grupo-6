export interface ElementoLimpieza {
  id: number;
  nombre: string;
  fecha_ultimo_recambio: string | null;
  frecuencia_recambio_dias: number | null;
  activo: boolean;
}
export type ElementoLimpiezaFormValues = Omit<ElementoLimpieza, "id" | "activo">;

/** Datos mínimos del elemento para seleccionarlo en el checklist. */
export interface ElementoLimpiezaOpcion {
  id: number;
  nombre: string;
}