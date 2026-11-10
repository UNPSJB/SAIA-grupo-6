export type TipoUnidadMedida = "masa" | "volumen" | "unidad";

export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  activo: boolean;
  tipo: TipoUnidadMedida;
  factor_a_base: number;
}

export type UnidadMedidaFormValues = Omit<UnidadMedida, "id" | "activo"> & {
  factor_a_base: string;
};
