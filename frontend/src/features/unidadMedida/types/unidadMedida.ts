export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  activo: boolean;
}

export type UnidadMedidaFormValues = Omit<UnidadMedida, "id" | "activo">;
