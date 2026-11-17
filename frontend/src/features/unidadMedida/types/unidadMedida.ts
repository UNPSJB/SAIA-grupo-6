export type TipoUnidadMedida = "masa" | "volumen" | "unidad";

export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  activo: boolean;
  tipo: TipoUnidadMedida;
  factor_a_base: number;
}

/** Lo que el formulario entrega y la API recibe. */
export type UnidadMedidaInput = Omit<UnidadMedida, "id" | "activo">;

/** Estado del formulario: el factor como texto para permitir vacío y coma decimal. */
export type UnidadMedidaFormValues = Omit<UnidadMedidaInput, "factor_a_base"> & {
  factor_a_base: string;
};
